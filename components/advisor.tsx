"use client";

import { ArrowRight, Check, Loader2, Lock, MapPin, Pencil, RotateCcw, Search, SendHorizonal, Sparkles, Volume2, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import insights from "@/lib/generated/insights.json";
import { BUSINESS_TYPES, CITIES, NEEDS, PRODUCTS } from "@/lib/catalogue";
import { templateExplanation } from "@/lib/engine/explain";
import { parseFreeText } from "@/lib/engine/parse";
import { inr, priceQuote } from "@/lib/engine/pricing";
import { recommend } from "@/lib/engine/recommend";
import { validateGstin } from "@/lib/kyc/gstin";
import { useJourney, useT } from "@/lib/store";
import type { InternetNow, Need, Profile } from "@/lib/types";
import { BundlePill, LiveBundle, ProductTile } from "./bundle";
import { MicButton, speak } from "./mic";
import { PERSONAS } from "./personas";
import { Badge, Button, Card, Chip, cn, Progress, Rupees, spring } from "./ui";

const STEPS = ["type", "team", "sites", "city", "internet", "needs", "gst"] as const;
type Step = (typeof STEPS)[number];
type Entry = { id: number; kind: "qa"; step: Step } | { id: number; kind: "user"; text: string } | { id: number; kind: "ack"; patch: Partial<Profile> };

const TEAM = [1, 3, 10, 30, 80];
const SITES = [1, 2, 4, 8, 12];
const NETS: InternetNow[] = ["hotspot", "home", "business", "leased", "mixed", "none"];
const NET_EMOJI: Record<InternetNow, string> = { hotspot: "📱", home: "🏠", business: "🏢", leased: "🔗", mixed: "🔀", none: "🚫" };
const TOP_CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Nagpur", "Jaipur", "Lucknow", "Surat"];
const SEG_MEDIAN: Record<string, number> = Object.fromEntries(
  insights.segments.map((s) => [{ "Micro retail & services": "micro", "Professional offices": "prof", "Small multi-site businesses": "multi", "Small manufacturers": "mfg" }[s.segment] ?? s.segment, s.medianMRR]),
);
const DEMO_GSTINS = [
  { g: "27PZSXS1936O1ZH", label: "Active" },
  { g: "37IHKXV5167L1ZS", label: "Cancelled" },
];

function answered(s: Step, p: Profile) {
  switch (s) {
    case "type": return !!p.businessType;
    case "team": return !!p.employees;
    case "sites": return !!p.sites;
    case "city": return !!p.city;
    case "internet": return !!p.internet || !!p.noFibre;
    case "needs": return !!p.needsAnswered;
    case "gst": return p.hasGstin !== undefined;
  }
}

let uid = 0;
const nextId = () => ++uid;

export function Advisor() {
  const t = useT();
  const router = useRouter();
  const lang = useJourney((s) => s.lang);
  const profile = useJourney((s) => s.profile);
  const patch = useJourney((s) => s.patchProfile);
  const setProfile = useJourney((s) => s.setProfile);
  const [log, setLog] = useState<Entry[]>(() => STEPS.filter((s) => answered(s, profile)).map((step) => ({ id: nextId(), kind: "qa" as const, step })));
  const [editing, setEditing] = useState<Step | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [interim, setInterim] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const current: Step | null = editing ?? STEPS.find((s) => !answered(s, profile)) ?? null;
  const done = !editing && (!current || skipped);
  const rec = useMemo(() => recommend(profile), [profile]);
  const progress = STEPS.filter((s) => answered(s, profile)).length / STEPS.length;

  useEffect(() => {
    const id = setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
    return () => clearTimeout(id);
  }, [log.length, current, done]);

  const answer = (step: Step, p: Partial<Profile>) => {
    patch(p);
    setLog((l) => (l.some((e) => e.kind === "qa" && e.step === step) ? l : [...l, { id: nextId(), kind: "qa", step }]));
    setEditing(null);
  };

  const sendText = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setInterim("");
    const { patch: p, found } = parseFreeText(clean);
    setLog((l) => [...l, { id: nextId(), kind: "user", text: clean }, { id: nextId(), kind: "ack", patch: found.length ? p : {} }]);
    if (found.length) patch(p);
    setEditing(null);
    // AI refinement (only fills gaps; returns instantly when no key is configured)
    try {
      const res = await fetch("/api/advisor/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean, lang: useJourney.getState().lang }) });
      const j = (await res.json()) as { patch: Partial<Profile>; source: string };
      if (j.source !== "rules") {
        const cur = useJourney.getState().profile;
        const extra: Partial<Profile> = {};
        for (const [k, v] of Object.entries(j.patch)) if ((cur as unknown as Record<string, unknown>)[k] === undefined) (extra as Record<string, unknown>)[k] = v;
        if (Object.keys(extra).length) patch(extra);
      }
    } catch {
      /* rules already applied */
    }
  };

  // Persona deep-link from the landing page (?persona=kirana)
  useEffect(() => {
    const persona = new URLSearchParams(window.location.search).get("persona") ?? sessionStorage.getItem("accel-persona");
    sessionStorage.removeItem("accel-persona");
    if (persona && PERSONAS[persona]) {
      window.history.replaceState(null, "", "/advisor");
      setProfile({ needs: [] });
      setLog([]);
      setSkipped(false);
      setTimeout(() => sendText(PERSONAS[persona].text[useJourney.getState().lang]), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
    setProfile({ needs: [] });
    setLog([]);
    setEditing(null);
    setSkipped(false);
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-48 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-32">
      <section className="min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <Progress value={done ? 1 : progress} className="flex-1" />
          <span className="num text-[12px] font-bold text-muted">{Math.round((done ? 1 : progress) * 100)}%</span>
        </div>

        <div className="space-y-3">
          <BotBubble>{t("adv.intro")}</BotBubble>
          {log.length === 0 && !done && <PersonaRow onPick={(txt) => sendText(txt)} />}

          {log.map((e) => {
            if (e.kind === "qa")
              return (
                <div key={e.id} className="space-y-2">
                  <BotBubble muted>{t(`adv.q.${e.step}`)}</BotBubble>
                  <UserBubble onEdit={() => setEditing(e.step)} editing={editing === e.step}>
                    {answerLabel(e.step, profile, t)}
                  </UserBubble>
                </div>
              );
            if (e.kind === "user") return <UserBubble key={e.id}>{e.text}</UserBubble>;
            return <AckBubble key={e.id} patch={e.patch} onEdit={(s) => setEditing(s)} />;
          })}

          <AnimatePresence mode="wait">
            {!done && current && (
              <motion.div key={`${current}-${editing ? "edit" : "new"}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="space-y-3">
                <BotBubble>
                  <span className="mr-2 inline-block rounded-full bg-brand-soft px-2 py-0.5 align-middle text-[11px] font-bold text-brand-dark">{t("adv.step", { n: STEPS.indexOf(current) + 1, total: STEPS.length })}</span>
                  {t(`adv.q.${current}`)}
                  {current === "gst" && <span className="mt-1 block text-[13px] font-medium text-muted">{t("adv.q.gst.sub")}</span>}
                </BotBubble>
                <StepOptions step={current} profile={profile} onAnswer={answer} />
                {!editing && profile.businessType && current !== "type" && (
                  <button onClick={() => setSkipped(true)} className="ml-1 text-[13px] font-semibold text-muted underline-offset-4 hover:text-brand hover:underline">
                    {t("adv.result.cta")} →
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {done && <Result profile={profile} onRestart={restart} onQuote={() => router.push("/quote")} />}
        </div>
        <div ref={bottom} className="h-2" />
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <Card className="p-5">
            <LiveBundle rec={rec} profile={profile} />
            {profile.segment && SEG_MEDIAN[profile.segment] && (
              <div className="mt-4 rounded-2xl bg-sky-soft/60 px-3 py-2 text-[12px] font-semibold text-sky">
                {t("adv.budgetHint", { type: t(`seg.${profile.segment}`), amount: inr(SEG_MEDIAN[profile.segment]) })}
              </div>
            )}
            {done && (
              <Button full className="mt-4" onClick={() => router.push("/quote")}>
                {t("adv.result.cta")} <ArrowRight className="size-4" />
              </Button>
            )}
          </Card>
        </div>
      </aside>

      {/* Bottom dock: live bundle (mobile) + composer */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-cream via-cream/95 to-cream/0 pt-6">
        <div className="safe-bottom mx-auto max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
          <div>
            {!done && <BundlePill rec={rec} profile={profile} />}
            <Composer onSend={sendText} interim={interim} setInterim={setInterim} />
          </div>
        </div>
      </div>
    </div>
  );
}

function answerLabel(step: Step, p: Profile, t: ReturnType<typeof useT>): string {
  switch (step) {
    case "type": return `${BUSINESS_TYPES.find((b) => b.key === p.businessType)?.emoji ?? ""} ${t(`biz.${p.businessType}`)}`;
    case "team": return TEAM.includes(p.employees ?? 0) ? t(`team.${p.employees}`) : String(p.employees);
    case "sites": return SITES.includes(p.sites ?? 0) ? t(`sites.${p.sites}`) : String(p.sites);
    case "city": return `📍 ${p.city}`;
    case "internet": return p.noFibre ? t("net.noFibre") : `${NET_EMOJI[p.internet!]} ${t(`net.${p.internet}`)}`;
    case "needs": return p.needs.length ? p.needs.map((n) => t(`need.${n}`)).join(" · ") : t("adv.needs.none");
    case "gst": return p.hasGstin ? `✅ ${p.businessName ?? p.gstin ?? "GSTIN"}` : t("adv.gst.no");
  }
}

function BotBubble({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className="flex items-end gap-2">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-pop", muted && "opacity-0")}>
        <svg viewBox="0 0 64 64" className="size-5"><path d="M20 46 32 16l12 30" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><path d="M25 36h14" stroke="#fff" strokeWidth="6" strokeLinecap="round" /></svg>
      </span>
      <div className={cn("max-w-[85%] rounded-3xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed", muted ? "bg-transparent px-1 py-0 text-[13px] font-semibold text-muted" : "border border-line/70 bg-white font-medium shadow-card")}>{children}</div>
    </motion.div>
  );
}

function UserBubble({ children, onEdit, editing }: { children: React.ReactNode; onEdit?: () => void; editing?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring} className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className={cn("group max-w-[85%] rounded-3xl rounded-br-md bg-ink px-4 py-2.5 text-left text-[14.5px] font-semibold text-white shadow-soft", onEdit && "hover:bg-black", editing && "ring-4 ring-brand/30")}
      >
        {children}
        {onEdit && <Pencil className="ml-2 inline size-3.5 opacity-40 transition group-hover:opacity-90" />}
      </button>
    </motion.div>
  );
}

function AckBubble({ patch, onEdit }: { patch: Partial<Profile>; onEdit: (s: Step) => void }) {
  const t = useT();
  const items: { step: Step; label: string }[] = [];
  if (patch.businessType) items.push({ step: "type", label: `${BUSINESS_TYPES.find((b) => b.key === patch.businessType)?.emoji} ${t(`biz.${patch.businessType}`)}` });
  if (patch.employees) items.push({ step: "team", label: `👥 ${patch.employees}` });
  if (patch.sites) items.push({ step: "sites", label: `🏬 ${patch.sites}` });
  if (patch.city) items.push({ step: "city", label: `📍 ${patch.city}` });
  if (patch.internet) items.push({ step: "internet", label: `${NET_EMOJI[patch.internet]} ${t(`net.${patch.internet}`)}` });
  if (patch.noFibre) items.push({ step: "internet", label: `📡 ${t("net.noFibre")}` });
  for (const n of patch.needs ?? []) items.push({ step: "needs", label: `${NEEDS.find((x) => x.key === n)?.emoji} ${t(`need.${n}`)}` });
  if (patch.hasGstin !== undefined) items.push({ step: "gst", label: patch.hasGstin ? "GST ✓" : "GST ✗" });
  return (
    <BotBubble>
      {items.length ? (
        <>
          <span className="flex items-center gap-1.5 font-bold"><Wand2 className="size-4 text-brand" /> {t("adv.understood")}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {items.map((i, k) => (
              <motion.button key={k} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: k * 0.04 }} onClick={() => onEdit(i.step)} className="rounded-full bg-brand-tint px-2.5 py-1 text-[12.5px] font-bold text-brand-dark ring-1 ring-brand/15 hover:bg-brand-soft">
                {i.label}
              </motion.button>
            ))}
          </span>
        </>
      ) : (
        t("adv.understoodNothing")
      )}
    </BotBubble>
  );
}

function PersonaRow({ onPick }: { onPick: (text: string) => void }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pl-14">
      {Object.entries(PERSONAS).map(([k, p], i) => (
        <motion.button key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 + i * 0.05 }} whileTap={{ scale: 0.96 }} onClick={() => onPick(p.text[lang])} className="flex shrink-0 items-center gap-2 rounded-full border border-dashed border-brand/40 bg-white px-3 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
          <span>{p.emoji}</span> {t(`persona.${k}`)}
        </motion.button>
      ))}
    </div>
  );
}

function StepOptions({ step, profile, onAnswer }: { step: Step; profile: Profile; onAnswer: (s: Step, p: Partial<Profile>) => void }) {
  const t = useT();
  const grid = "grid grid-cols-2 gap-2 pl-10 sm:grid-cols-3";
  const stagger = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { ...spring, delay: i * 0.025 } });

  if (step === "type")
    return (
      <div className={grid}>
        {BUSINESS_TYPES.map((b, i) => (
          <motion.div key={b.key} {...stagger(i)}>
            <Chip emoji={b.emoji} selected={profile.businessType === b.key} onClick={() => onAnswer("type", { businessType: b.key, ...(b.segment === "multi" && (profile.sites ?? 0) < 3 ? { sites: undefined } : {}) })} className="w-full">
              {t(`biz.${b.key}`)}
            </Chip>
          </motion.div>
        ))}
      </div>
    );

  if (step === "team" || step === "sites") {
    const values = step === "team" ? TEAM : (profile.businessType === "chain" ? SITES.filter((n) => n >= 4) : SITES);
    return (
      <div className="flex flex-wrap gap-2 pl-10">
        {values.map((n, i) => (
          <motion.div key={n} {...stagger(i)}>
            <Chip selected={(step === "team" ? profile.employees : profile.sites) === n} onClick={() => onAnswer(step, step === "team" ? { employees: n } : { sites: n })} className="min-w-[76px] justify-center text-center">
              {t(`${step}.${n}`)}
            </Chip>
          </motion.div>
        ))}
      </div>
    );
  }

  if (step === "city") return <CityPicker profile={profile} onPick={(c) => onAnswer("city", { city: c })} />;

  if (step === "internet")
    return (
      <div className="space-y-2 pl-10">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NETS.map((n, i) => (
            <motion.div key={n} {...stagger(i)}>
              <Chip emoji={NET_EMOJI[n]} selected={profile.internet === n} onClick={() => onAnswer("internet", { internet: n, noFibre: profile.noFibre })} className="w-full">
                {t(`net.${n}`)}
              </Chip>
            </motion.div>
          ))}
        </div>
        <Chip emoji="📡" selected={!!profile.noFibre} onClick={() => onAnswer("internet", { noFibre: !profile.noFibre, internet: profile.internet ?? "hotspot" })} className="w-full sm:w-auto">
          {t("net.noFibre")}
        </Chip>
      </div>
    );

  if (step === "needs") return <NeedsPicker profile={profile} onDone={() => onAnswer("needs", { needsAnswered: true })} />;

  return <GstPicker onAnswer={(p) => onAnswer("gst", p)} />;
}

function CityPicker({ profile, onPick }: { profile: Profile; onPick: (c: string) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const all = Object.keys(CITIES).sort();
  const matches = q ? all.filter((c) => c.toLowerCase().startsWith(q.toLowerCase())) : [];
  return (
    <div className="space-y-2 pl-10">
      <div className="flex flex-wrap gap-2">
        {TOP_CITIES.map((c, i) => (
          <motion.div key={c} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: i * 0.02 }}>
            <Chip selected={profile.city === c} onClick={() => onPick(c)} className="min-h-10 py-1.5">
              {c}
            </Chip>
          </motion.div>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q.trim() && onPick(matches[0] ?? q.trim().replace(/^\w/, (c) => c.toUpperCase()))}
          placeholder={`${t("adv.searchCity")} · ${t("adv.otherCity")}`}
          className="h-12 w-full rounded-2xl border border-line bg-white pl-10 pr-4 text-[14.5px] font-medium shadow-card outline-none focus:border-brand focus:shadow-ring"
        />
      </div>
      <AnimatePresence>
        {q && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
            {matches.slice(0, 6).map((c) => (
              <Chip key={c} onClick={() => onPick(c)} className="min-h-10 py-1.5">
                <MapPin className="mr-1 inline size-3.5" />
                {c} <span className="text-[11px] font-bold text-muted">T{CITIES[c].tier}</span>
              </Chip>
            ))}
            {!matches.some((m) => m.toLowerCase() === q.trim().toLowerCase()) && (
              <Chip onClick={() => onPick(q.trim().replace(/^\w/, (c) => c.toUpperCase()))} className="min-h-10 py-1.5">
                ＋ {q.trim()}
              </Chip>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NeedsPicker({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const t = useT();
  const setProfile = useJourney((s) => s.setProfile);
  const popular = BUSINESS_TYPES.find((b) => b.key === profile.businessType)?.needs ?? [];
  const ordered = [...popular, ...NEEDS.map((n) => n.key).filter((k) => !popular.includes(k))];
  const toggle = (n: Need) => {
    const has = profile.needs.includes(n);
    setProfile({ ...profile, needs: has ? profile.needs.filter((x) => x !== n) : [...profile.needs, n] });
  };
  return (
    <div className="space-y-3 pl-10">
      {popular.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#9a6200]">
          <Sparkles className="size-3.5" /> {t("adv.popular")}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ordered.map((n, i) => (
          <motion.div key={n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.02 }}>
            <Chip emoji={NEEDS.find((x) => x.key === n)?.emoji} hint={popular.includes(n)} selected={profile.needs.includes(n)} onClick={() => toggle(n)} className="w-full">
              {t(`need.${n}`)}
            </Chip>
          </motion.div>
        ))}
      </div>
      <Button onClick={onDone} variant={profile.needs.length ? "primary" : "secondary"}>
        {profile.needs.length ? (
          <>
            <Check className="size-4" /> {t("adv.needs.done")} · {profile.needs.length}
          </>
        ) : (
          t("adv.needs.none")
        )}
      </Button>
    </div>
  );
}

type GstState = { kind: "idle" } | { kind: "checking" } | { kind: "invalid"; why: string } | { kind: "found"; status: string; name: string; gstin: string } | { kind: "notfound"; gstin: string };

function GstPicker({ onAnswer }: { onAnswer: (p: Partial<Profile>) => void }) {
  const t = useT();
  const [mode, setMode] = useState<"ask" | "enter">("ask");
  const [value, setValue] = useState("");
  const [st, setSt] = useState<GstState>({ kind: "idle" });

  const check = async (raw: string) => {
    const g = raw.replace(/\s/g, "").toUpperCase();
    setValue(g);
    if (g.length < 15) return setSt({ kind: "idle" });
    const v = validateGstin(g);
    if (!v.ok) return setSt({ kind: "invalid", why: t(`adv.gst.why.${v.reason}`) });
    setSt({ kind: "checking" });
    const res = await fetch(`/api/gstin/${g}`);
    const j = await res.json();
    if (!j.found) setSt({ kind: "notfound", gstin: g });
    else setSt({ kind: "found", status: j.status, name: j.tradeName, gstin: g });
  };

  if (mode === "ask")
    return (
      <div className="flex gap-2 pl-10">
        <Chip emoji="✅" onClick={() => setMode("enter")} className="flex-1 justify-center">{t("c.yes")}</Chip>
        <Chip emoji="⏳" onClick={() => onAnswer({ hasGstin: false, gstin: undefined, gstStatus: undefined })} className="flex-1 justify-center">{t("adv.gst.no")}</Chip>
      </div>
    );

  const ok = st.kind === "found";
  return (
    <div className="space-y-2 pl-10">
      <div className="relative">
        <input
          autoFocus
          value={value}
          maxLength={15}
          onChange={(e) => check(e.target.value)}
          placeholder={t("adv.gst.placeholder")}
          className={cn("num h-14 w-full rounded-2xl border bg-white px-4 font-mono text-[17px] font-bold uppercase tracking-[0.12em] shadow-card outline-none transition focus:shadow-ring", st.kind === "invalid" ? "border-rose" : ok ? "border-mint" : "border-line focus:border-brand")}
        />
        <span className="num absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted">{st.kind === "checking" ? <Loader2 className="size-4 animate-spin" /> : `${value.length}/15`}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEMO_GSTINS.map((d) => (
          <button key={d.g} onClick={() => check(d.g)} className="rounded-full bg-sand px-2.5 py-1 font-mono text-[11.5px] font-bold text-ink-2 hover:bg-brand-soft">
            demo: {d.g} · {d.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {st.kind === "invalid" && <Note key="inv" tone="rose">{t("adv.gst.invalid", { why: st.why })}</Note>}
        {st.kind === "notfound" && <Note key="nf" tone="amber">{t("adv.gst.notFound")}</Note>}
        {st.kind === "found" && (
          <Note key="f" tone={st.status === "Active" ? "mint" : "rose"}>
            {st.status === "Active" ? t("adv.gst.active", { name: st.name }) : t(st.status === "Cancelled" ? "adv.gst.cancelled" : "adv.gst.suspended")}
          </Note>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap gap-2">
        <Button disabled={st.kind !== "found" && st.kind !== "notfound"} onClick={() => st.kind === "found" ? onAnswer({ hasGstin: true, gstin: st.gstin, gstStatus: st.status as Profile["gstStatus"], businessName: st.name }) : st.kind === "notfound" && onAnswer({ hasGstin: true, gstin: st.gstin, gstStatus: "NotFound" })}>
          {t("c.continue")} <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" onClick={() => onAnswer({ hasGstin: false, gstin: undefined, gstStatus: undefined })}>{t("adv.gst.useAnyway")}</Button>
      </div>
    </div>
  );
}

function Note({ children, tone }: { children: React.ReactNode; tone: "mint" | "rose" | "amber" }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("rounded-2xl px-3.5 py-2.5 text-[13.5px] font-semibold", tone === "mint" && "bg-mint-soft text-mint", tone === "rose" && "bg-rose-soft text-rose", tone === "amber" && "bg-amber-soft text-amber")}>
      {children}
    </motion.div>
  );
}

function Composer({ onSend, interim, setInterim }: { onSend: (t: string) => void; interim: string; setInterim: (s: string) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const value = interim || text;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend(value);
        setText("");
      }}
      className="flex items-center gap-2 rounded-[22px] border border-line bg-white p-1.5 pl-4 shadow-soft focus-within:border-brand/50 focus-within:shadow-ring"
    >
      <input value={value} onChange={(e) => { setInterim(""); setText(e.target.value); }} placeholder={interim ? t("adv.listening") : t("adv.composer")} className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium outline-none placeholder:text-muted/80" />
      <MicButton onText={(s) => { onSend(s); setText(""); }} onInterim={setInterim} />
      <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!value.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-pop transition disabled:bg-sand disabled:text-muted disabled:shadow-none">
        <SendHorizonal className="size-[18px]" />
      </motion.button>
    </form>
  );
}

function Result({ profile, onRestart, onQuote }: { profile: Profile; onRestart: () => void; onQuote: () => void }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  const rec = useMemo(() => recommend(profile), [profile]);
  const q = useMemo(() => priceQuote(rec.lines, 12), [rec.lines]);
  const on = rec.lines.filter((l) => l.on);
  const template = useMemo(() => templateExplanation(profile, rec, t, lang), [profile, rec, t, lang]);
  const [ai, setAi] = useState<string | null>(null);
  const [callback, setCallback] = useState(false);

  useEffect(() => {
    setAi(null);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/advisor/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { ...profile, gstin: undefined }, lang }), signal: ctrl.signal });
        if (res.status !== 200 || !res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setAi(acc);
        }
      } catch {
        /* keep template */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [profile, lang]);

  const requestCallback = async () => {
    setCallback(true);
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { ...profile, gstin: undefined }, lang, kind: "callback", stage: "advisor" }) });
  };

  const words = (ai ?? template).split(" ");
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
      <Card className="overflow-hidden">
        <div className="relative overflow-hidden bg-ink px-5 pb-6 pt-5 text-white">
          <div className="absolute -right-10 -top-16 size-48 rounded-full bg-brand/40 blur-3xl" />
          <div className="absolute -bottom-20 left-10 size-40 rounded-full bg-saffron/30 blur-3xl" />
          <div className="relative">
            <Badge tone="saffron" className="bg-saffron text-ink">🎉 {t("adv.result.title")}</Badge>
            <div className="mt-3 flex items-baseline gap-1.5">
              <Rupees value={q.monthly} className="text-[44px] font-extrabold leading-none tracking-tight" />
              <span className="text-[15px] font-semibold text-white/60">{t("c.perMonth")}</span>
            </div>
            <div className="mt-1.5 text-[13px] text-white/70">
              {t("adv.result.sub", { n: on.length })}
              {q.setup > 0 && ` · + ${inr(q.setup)} ${t("c.oneTime")}`}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl bg-brand-tint p-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-brand-dark">{t("adv.why")}</span>
              <span className="flex items-center gap-2">
                <Badge tone={ai ? "sky" : "neutral"}>{ai ? <><Sparkles className="size-3" /> {t("adv.why.ai")}</> : t("adv.why.template")}</Badge>
                <button onClick={() => speak(ai ?? template, lang)} aria-label="Read aloud" className="grid size-7 place-items-center rounded-full bg-white text-brand shadow-card hover:bg-brand-soft">
                  <Volume2 className="size-3.5" />
                </button>
              </span>
            </div>
            <p className="text-[14.5px] font-medium leading-relaxed text-ink-2">
              {words.map((w, i) => (
                <motion.span key={`${i}-${w}`} initial={ai ? false : { opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.25, delay: ai ? 0 : Math.min(i * 0.012, 0.9) }}>
                  {w}{" "}
                </motion.span>
              ))}
            </p>
          </div>

          <ul className="space-y-2.5">
            {on.map((l, i) => {
              const line = q.lines.find((x) => x.id === l.id)!;
              return (
                <motion.li key={l.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.1 + i * 0.05 }} className="flex gap-3">
                  <ProductTile id={l.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14.5px] font-bold">{t(`plain.${l.id}`)}{l.qty > 1 && <span className="text-muted"> ×{l.qty}</span>}</span>
                      <span className="num shrink-0 text-[14px] font-bold">{inr(line.monthly)}</span>
                    </div>
                    <div className="text-[12.5px] leading-snug text-muted">{t(l.reason)}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-muted/80">{PRODUCTS[l.id].name}</div>
                  </div>
                </motion.li>
              );
            })}
          </ul>

          {rec.blocked.length > 0 && (
            <div className="rounded-2xl border border-dashed border-line p-3.5">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("adv.notIncluded")}</div>
              <ul className="space-y-1.5">
                {rec.blocked.map((b) => (
                  <li key={b.id} className="flex items-start gap-2 text-[13px] text-ink-2">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" />
                    <span>
                      <b>{t(`plain.${b.id}`)}</b> — {t(`blocked.${b.reason}`, { ...b.params, city: profile.city ?? "" })}
                      {b.alt && <span className="text-mint"> · {t("blocked.alt", { alt: t(`plain.${b.alt}`) })}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" full onClick={onQuote}>
              {t("adv.result.cta")} <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={requestCallback} disabled={callback} className="sm:w-auto">
              🙋 {t("c.talkToHuman")}
            </Button>
          </div>
          <AnimatePresence>
            {callback && <Note tone="mint">{t("c.callbackDone")}</Note>}
          </AnimatePresence>
          <div className="flex justify-between text-[13px]">
            <button onClick={onRestart} className="flex items-center gap-1.5 font-semibold text-muted hover:text-brand">
              <RotateCcw className="size-3.5" /> {t("adv.result.restart")}
            </button>
            <Link href="/chat" className="font-semibold text-muted hover:text-brand">{t("home.chat")} →</Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
