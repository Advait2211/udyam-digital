import "server-only";
import { BUSINESS_TYPES, CITIES, NEEDS, PRODUCTS } from "./catalogue";
import { mergeProfile, parseFreeText } from "./engine/parse";
import { inr, priceQuote } from "./engine/pricing";
import { recommend } from "./engine/recommend";
import { translate } from "./i18n";
import { gstLookup } from "./kyc/registry";
import type { Lang, Need, Profile } from "./types";

export type Step = "lang" | "type" | "team" | "sites" | "city" | "needs" | "gst" | "gstin" | "result";
export interface ChatState { lang: Lang; step: Step; profile: Profile }
export interface BotMsg { text: string; options?: { id: string; label: string }[]; style?: "buttons" | "list"; link?: { href: string; label: string } }

const TEAM = [1, 3, 10, 30, 80];
const SITES = [1, 2, 4, 8, 12];
const TOP_CITIES = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Nagpur", "Jaipur", "Lucknow"];

export function detectLang(text: string): Lang | undefined {
  if (!/[ऀ-ॿ]/.test(text)) return undefined;
  return /(आहे|माझ|मला|हवे|आणि|नाही|आमच|कर्मचारी आहेत|किती)/.test(text) ? "mr" : "hi";
}

function nextStep(p: Profile): Step {
  if (!p.businessType) return "type";
  if (!p.employees) return "team";
  if (!p.sites) return "sites";
  if (!p.city) return "city";
  if (!p.needsAnswered) return "needs";
  if (p.hasGstin === undefined) return "gst";
  return "result";
}

function ask(step: Step, s: ChatState, origin: string): BotMsg {
  const t = (k: string, p?: Record<string, string | number>) => translate(s.lang, k, p);
  switch (step) {
    case "lang":
      return { text: "Namaste 🙏 Choose your language · भाषा चुनें · भाषा निवडा", options: [{ id: "lang:en", label: "English" }, { id: "lang:hi", label: "हिंदी" }, { id: "lang:mr", label: "मराठी" }], style: "buttons" };
    case "type":
      return { text: t("adv.q.type"), options: BUSINESS_TYPES.map((b) => ({ id: `type:${b.key}`, label: `${b.emoji} ${t(`biz.${b.key}`)}` })), style: "list" };
    case "team":
      return { text: t("adv.q.team"), options: TEAM.map((n) => ({ id: `team:${n}`, label: t(`team.${n}`) })), style: "list" };
    case "sites":
      return { text: t("adv.q.sites"), options: SITES.map((n) => ({ id: `sites:${n}`, label: t(`sites.${n}`) })), style: "list" };
    case "city":
      return { text: t("adv.q.city"), options: TOP_CITIES.map((c) => ({ id: `city:${c}`, label: c })), style: "list" };
    case "needs": {
      const type = BUSINESS_TYPES.find((b) => b.key === s.profile.businessType);
      const picked = new Set(s.profile.needs);
      const order: Need[] = [...(type?.needs ?? []), ...NEEDS.map((n) => n.key).filter((k) => !type?.needs.includes(k))].slice(0, 9);
      return {
        text: t("adv.q.needs") + (picked.size ? `\n✅ ${[...picked].map((n) => t(`need.${n}`)).join(", ")}` : ""),
        options: [{ id: "needs:done", label: picked.size ? `✔ ${t("adv.needs.done")}` : t("adv.needs.none") }, ...order.filter((n) => !picked.has(n)).map((n) => ({ id: `need:${n}`, label: `${NEEDS.find((x) => x.key === n)?.emoji} ${t(`need.${n}`)}` }))],
        style: "list",
      };
    }
    case "gst":
      return { text: `${t("adv.q.gst")}\n${t("adv.q.gst.sub")}`, options: [{ id: "gst:yes", label: t("c.yes") }, { id: "gst:no", label: t("adv.gst.no") }], style: "buttons" };
    case "gstin":
      return { text: t("adv.gst.placeholder"), options: [{ id: "gst:no", label: t("adv.gst.useAnyway") }], style: "buttons" };
    case "result": {
      const r = recommend(s.profile);
      const on = r.lines.filter((l) => l.on);
      const q = priceQuote(on, 12);
      const items = on.map((l) => `• ${t(`plain.${l.id}`)}${l.qty > 1 ? ` ×${l.qty}` : ""} — ${inr(q.lines.find((x) => x.id === l.id)!.monthly)}`).join("\n");
      const blocked = r.blocked.filter((b) => !b.alt).map((b) => `🔒 ${t(`plain.${b.id}`)}: ${t(`blocked.${b.reason}`, { ...b.params, city: s.profile.city ?? "" })}`).join("\n");
      const enc = Buffer.from(JSON.stringify({ ...s.profile, gstin: undefined })).toString("base64url");
      return {
        text: `🎉 ${t("adv.result.title")}\n\n${items}${blocked ? `\n\n${blocked}` : ""}\n\n*${inr(q.monthly)}${t("c.perMonth")}* · ${t("q.ready", { days: t("c.days", { n: q.maxInstallDays }) })}`,
        options: [{ id: "human", label: `🙋 ${t("c.talkToHuman")}` }, { id: "restart", label: `↺ ${t("adv.result.restart")}` }],
        style: "buttons",
        link: { href: `${origin}/quote?p=${enc}&lang=${s.lang}`, label: t("adv.result.cta") },
      };
    }
  }
}

/** One turn of the conversation. Pure function over state → replies. */
export function chatTurn(state: ChatState | null, input: { text?: string; optionId?: string }, origin: string): { state: ChatState; replies: BotMsg[]; handoff?: boolean } {
  const text = (input.text ?? "").trim();
  let s: ChatState = state ?? { lang: detectLang(text) ?? "en", step: "lang", profile: { needs: [] } };
  const replies: BotMsg[] = [];
  const t = (k: string, p?: Record<string, string | number>) => translate(s.lang, k, p);
  let handoff = false;

  const opt = input.optionId ?? "";
  if (opt === "restart" || /^(restart|start over|hi|hello|namaste|नमस्ते|नमस्कार)$/i.test(text)) {
    s = { lang: s.lang, step: state ? "type" : "lang", profile: { needs: [] } };
    if (state) replies.push({ text: t("adv.intro") });
    replies.push(ask(s.step, s, origin));
    return { state: s, replies };
  }
  if (opt.startsWith("lang:")) {
    s = { ...s, lang: opt.slice(5) as Lang };
    replies.push({ text: translate(s.lang, "adv.intro") });
    s.step = nextStep(s.profile);
    replies.push(ask(s.step, s, origin));
    return { state: s, replies };
  }
  if (opt === "human") {
    handoff = true;
    replies.push({ text: `✅ ${t("c.callbackDone")}` });
    return { state: s, replies, handoff };
  }

  let p = s.profile;
  if (opt.startsWith("type:")) p = mergeProfile(p, { businessType: opt.slice(5) });
  else if (opt.startsWith("team:")) p = mergeProfile(p, { employees: Number(opt.slice(5)) });
  else if (opt.startsWith("sites:")) p = mergeProfile(p, { sites: Number(opt.slice(6)) });
  else if (opt.startsWith("city:")) p = mergeProfile(p, { city: opt.slice(5) });
  else if (opt.startsWith("need:")) p = { ...p, needs: [...new Set([...p.needs, opt.slice(5) as Need])] };
  else if (opt === "needs:done") p = { ...p, needsAnswered: true };
  else if (opt === "gst:no") p = { ...p, hasGstin: false, gstin: undefined, gstStatus: undefined };
  else if (opt === "gst:yes") {
    s = { ...s, profile: p, step: "gstin" };
    replies.push(ask("gstin", s, origin));
    return { state: s, replies };
  } else if (text) {
    if (s.step === "lang") {
      s.lang = detectLang(text) ?? s.lang;
    }
    const gst = text.replace(/\s/g, "").toUpperCase().match(/\d{2}[A-Z0-9]{13}/);
    if ((s.step === "gstin" || s.step === "gst") && gst) {
      const r = gstLookup(gst[0]);
      if (!r.valid) {
        replies.push({ text: `⚠️ ${t("adv.gst.invalid", { why: t(`adv.gst.why.${r.validity.reason}`) })}` });
        replies.push(ask("gstin", s, origin));
        return { state: s, replies };
      }
      const status = r.record?.status ?? "NotFound";
      p = { ...p, hasGstin: true, gstin: r.gstin, gstStatus: status as Profile["gstStatus"], businessName: r.record?.tradeName };
      replies.push({ text: status === "Active" ? `✅ ${t("adv.gst.active", { name: r.record!.tradeName })}` : status === "NotFound" ? `⚠️ ${t("adv.gst.notFound")}` : `⚠️ ${t(status === "Cancelled" ? "adv.gst.cancelled" : "adv.gst.suspended")}` });
    } else if (s.step === "city" && Object.keys(CITIES).some((c) => c.toLowerCase() === text.toLowerCase())) {
      p = mergeProfile(p, { city: Object.keys(CITIES).find((c) => c.toLowerCase() === text.toLowerCase()) });
    } else {
      const { patch, found } = parseFreeText(text);
      if (found.length) {
        p = mergeProfile(p, patch);
        const bits = [
          patch.businessType && t(`biz.${patch.businessType}`),
          patch.employees && t("explain.teamN", { n: patch.employees }),
          patch.sites && patch.sites > 1 && `${patch.sites} ${t("unit.per site").replace(/^\S+\s/, "")}`,
          patch.city,
          patch.hasGstin === false && "GST ✗",
          patch.hasGstin && "GST ✓",
          ...(patch.needs ?? []).map((n) => t(`need.${n}`)),
        ].filter(Boolean);
        replies.push({ text: `👍 ${t("adv.understood")}: ${bits.join(" · ")}` });
      } else {
        replies.push({ text: t("adv.understoodNothing") });
      }
    }
  }

  const step = s.step === "needs" && !p.needsAnswered && opt.startsWith("need:") ? "needs" : nextStep(p);
  s = { ...s, profile: p, step };
  replies.push(ask(step, s, origin));
  return { state: s, replies, handoff };
}

export function summarizeForLead(p: Profile) {
  return Object.fromEntries(Object.entries(p).filter(([k]) => k !== "gstin"));
}

export const PRODUCT_NAMES = Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.id, p.name]));
