import { PRODUCTS } from "../catalogue";
import type { T } from "../i18n";
import type { Profile, Recommendation } from "../types";
import { CONNECTIVITY_IDS } from "./recommend";
import { inr, priceQuote } from "./pricing";

const list = (items: string[], lang: string) => {
  if (items.length <= 1) return items.join("");
  const and = lang === "hi" ? " और " : lang === "mr" ? " आणि " : " and ";
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
};

/** Plain-language explanation built from the deterministic recommendation (no AI needed). */
export function templateExplanation(p: Profile, r: Recommendation, t: T, lang: string): string {
  const core = r.lines.filter((l) => l.core && l.on);
  const conn = core.find((l) => CONNECTIVITY_IDS.includes(l.id));
  const lines = core.find((l) => l.id === "P07" || l.id === "P08");
  const extras = core.filter((l) => l !== conn && l !== lines);
  const q = priceQuote(core, 12);
  const type = p.businessType ? t(`biz.${p.businessType}`).toLowerCase() : t(`seg.${r.segment}`).toLowerCase();
  const team = (p.employees ?? 1) <= 1 ? t("explain.team1") : t("explain.teamN", { n: p.employees ?? 1 });
  const parts: string[] = [];
  parts.push(p.city ? t("explain.open", { type, team, city: p.city }) : t("explain.openNoCity", { type, team }));
  if (conn && lines)
    parts.push(
      t("explain.core", {
        conn: t(`plain.${conn.id}`),
        lines: `${lines.qty}× ${t(`plain.${lines.id}`).toLowerCase()}`,
      }),
    );
  if (extras.length) {
    const needs = [...new Set(extras.map((e) => e.need).filter(Boolean))].map((n) => t(`need.${n}`).toLowerCase());
    parts.push(t("explain.extras", { needs: list(needs, lang), items: list(extras.map((e) => t(`plain.${e.id}`)), lang) }));
  }
  const blocked = r.blocked.filter((b) => !b.alt);
  if (blocked.length) {
    const raw = t(`blocked.${blocked[0].reason}`, { ...blocked[0].params, city: p.city ?? "" });
    const why = lang === "en" ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
    parts.push(t("explain.blocked", { items: list(blocked.map((b) => t(`plain.${b.id}`)), lang), why }));
  }
  const days = q.maxInstallDays || Math.max(...core.map((l) => PRODUCTS[l.id].installDays), 1);
  parts.push(t("explain.close", { price: inr(q.monthly), days: days === 1 ? t("c.day") : t("c.days", { n: days }) }));
  return parts.join(" ");
}
