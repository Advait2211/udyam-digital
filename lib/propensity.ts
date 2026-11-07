import model from "./generated/propensity.json";
import type { Lang, Profile } from "./types";

type Model = {
  intercept: number;
  numeric: Record<string, { mean: number; std: number; w: number }>;
  categorical: Record<string, Record<string, number>>;
  cvAUC: number;
  baseRate: number;
  topDrivers: { feature: string; weight: number }[];
};
const M = model as Model;

const SEGMENT_NAME = { micro: "Micro retail & services", prof: "Professional offices", multi: "Small multi-site businesses", mfg: "Small manufacturers" } as const;
const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi", mr: "Marathi" };
const NET_NAME: Record<string, string> = { hotspot: "Mobile hotspot", home: "Home broadband", business: "Business broadband", leased: "Leased line", mixed: "Mixed per site" };

/** Likelihood (0–1) that a lead activates if a person follows up — same logistic model trained on smb_leads.csv. */
export function scoreLead(p: Profile, lang: Lang, source = "Website form"): number {
  const x: Record<string, number> = {
    log_emp: Math.log1p(p.employees ?? 3),
    log_sites: Math.log1p(p.sites ?? 1),
    log_spend: Math.log1p(p.spend ?? 0),
    tier1: p.tier === 1 ? 1 : 0,
    gstin: p.hasGstin ? 1 : 0,
    udyam: 0,
    n_interest: p.needs.length,
  };
  let z = M.intercept;
  for (const [k, v] of Object.entries(M.numeric)) z += ((x[k] ?? v.mean) - v.mean) / v.std * v.w;
  const cats: Record<string, string | undefined> = {
    lead_source: source,
    segment: p.segment ? SEGMENT_NAME[p.segment] : undefined,
    preferred_language: LANG_NAME[lang],
    current_internet: p.internet ? NET_NAME[p.internet] : undefined,
    contact_role: "Owner",
  };
  for (const [c, val] of Object.entries(cats)) if (val) z += M.categorical[c]?.[val] ?? 0;
  return 1 / (1 + Math.exp(-z));
}

export const PROPENSITY_META = { auc: M.cvAUC, baseRate: M.baseRate, drivers: M.topDrivers };
