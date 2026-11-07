import { BUSINESS_TYPES, PRODUCTS, segmentFor } from "../catalogue";
import type { Blocked, BundleLine, Need, Profile, Recommendation, Segment } from "../types";

const DEFAULT_EMP: Record<Segment, number> = { micro: 3, prof: 8, multi: 40, mfg: 60 };
const CONNECTIVITY = ["P01", "P02", "P03", "P04", "P05", "P06"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface Ctx {
  segment: Segment;
  employees: number;
  sites: number;
  tier: 1 | 2;
  gstOk: boolean;
  gstKnown: boolean;
  gstStatus?: string;
}

export function contextFor(p: Profile): Ctx {
  const segment = p.segment ?? segmentFor(p.businessType, p.sites) ?? "micro";
  const employees = Math.max(1, p.employees ?? DEFAULT_EMP[segment]);
  const sites = Math.max(1, p.sites ?? (segment === "multi" ? 4 : 1));
  const tier = p.tier ?? 2;
  const gstKnown = p.hasGstin !== undefined;
  // Before the owner answers, assume a GSTIN exists so the preview is not artificially thin.
  const gstOk = p.hasGstin === false ? false : !p.gstStatus || p.gstStatus === "Active";
  return { segment, employees, sites, tier, gstOk, gstKnown, gstStatus: p.gstStatus };
}

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: "tier" | "employees" | "sites" | "gstin" | "gstinStatus"; params?: Record<string, string | number> };

/** Catalogue eligibility rules (city tier, size, GSTIN). Dependencies are checked separately. */
export function eligible(id: string, c: Ctx): Eligibility {
  const p = PRODUCTS[id];
  if (!p.tiers.includes(c.tier)) return { ok: false, reason: "tier" };
  if (c.employees < p.minEmployees) return { ok: false, reason: "employees", params: { n: p.minEmployees } };
  if (c.sites < p.minSites) return { ok: false, reason: "sites", params: { n: p.minSites } };
  if (p.requiresGstin && !c.gstOk) {
    if (c.gstStatus && c.gstStatus !== "Active" && c.gstStatus !== "NotFound" && c.gstStatus !== "Invalid")
      return { ok: false, reason: "gstinStatus", params: { status: c.gstStatus } };
    return { ok: false, reason: "gstin" };
  }
  return { ok: true };
}

export function quantities(c: Ctx, p: Profile) {
  const { segment: s, employees: e, sites } = c;
  return {
    lines: s === "micro" ? (e <= 1 ? 1 : 2) : s === "prof" ? clamp(Math.ceil(e / 5), 1, 4) : s === "multi" ? clamp(Math.ceil(sites / 2), 2, 6) : clamp(Math.ceil(e / 25), 2, 6),
    users: s === "prof" ? Math.max(3, Math.round(e * 0.7)) : s === "multi" ? sites + 2 : s === "mfg" ? clamp(Math.round(e * 0.2), 3, 25) : Math.min(e, 2),
    devices: s === "prof" ? e : s === "multi" ? sites * 2 : s === "mfg" ? clamp(Math.round(e * 0.2), 3, 30) : Math.min(e, 2),
    cameras: p.cameras ?? (s === "multi" ? 2 * sites : s === "mfg" ? 6 : 2),
    counters: s === "multi" ? sites : 1,
    channels: s === "prof" ? clamp(Math.ceil(e / 5), 2, 6) : 4,
    machines: clamp(Math.ceil(e / 10), 2, 20),
    vehicles: p.vehicles ?? 2,
  };
}

/**
 * Deterministic bundle recommendation. The AI never picks products or prices; it only
 * explains what this function returns. Every line is guaranteed catalogue-eligible.
 */
export function recommend(p: Profile): Recommendation {
  const c = contextFor(p);
  const q = quantities(c, p);
  const lines: BundleLine[] = [];
  const blocked: Blocked[] = [];
  const has = (id: string) => lines.some((l) => l.id === id);

  const check = (id: string) => {
    const el = eligible(id, c);
    const deps = PRODUCTS[id].requiresOneOf;
    return { el, ok: el.ok && (deps.length === 0 || deps.some((d) => has(d))) };
  };
  const upgrade = (id: string, core: boolean) => {
    const l = lines.find((x) => x.id === id)!;
    if (core && !l.core) { l.core = true; l.on = true; }
  };

  const tryAdd = (id: string, qty: number, reason: string, opts: { core: boolean; need?: Need }, fallbacks: string[] = []): boolean => {
    if (has(id)) return upgrade(id, opts.core), true;
    const first = check(id);
    if (first.ok) {
      lines.push({ id, qty: Math.max(1, qty), on: opts.core, core: opts.core, reason, need: opts.need });
      return true;
    }
    const why = first.el.ok ? { reason: "depends" as const } : { reason: first.el.reason, params: first.el.params };
    for (const f of fallbacks) {
      if (has(f)) {
        upgrade(f, opts.core);
        if (opts.core) blocked.push({ id, ...why, alt: f });
        return true;
      }
      if (check(f).ok) {
        lines.push({ id: f, qty: Math.max(1, qty), on: opts.core, core: opts.core, reason: reason.replace(id, f), need: opts.need });
        if (opts.core) blocked.push({ id, ...why, alt: f });
        return true;
      }
    }
    if (opts.core) blocked.push({ id, ...why });
    return false;
  };

  // 1) Connectivity per site
  const perSiteStaff = c.employees / c.sites;
  let conn: string;
  let connFallbacks: string[] = [];
  if (c.segment === "mfg") {
    conn = c.employees >= 100 ? "P06" : c.employees >= 10 ? "P05" : "P02";
    connFallbacks = conn === "P06" ? ["P05", "P03", "P02"] : conn === "P05" ? ["P03", "P02"] : [];
  } else if (c.segment === "multi") {
    conn = perSiteStaff > 6 ? "P02" : "P01";
  } else if (c.segment === "prof") {
    conn = c.employees >= 15 && c.tier === 1 ? "P03" : "P02";
    connFallbacks = ["P02"];
  } else {
    conn = "P01";
  }
  if (p.internet === "leased" && c.segment !== "micro" && c.employees >= 10) {
    conn = "P05";
    connFallbacks = ["P03", "P02"];
  }
  if (p.noFibre && !["P05", "P06"].includes(conn)) {
    conn = "P04";
    connFallbacks = [];
  }
  tryAdd(conn, c.sites, p.noFibre ? "why.P04.noFibre" : `why.${conn}.${c.segment}`, { core: true }, connFallbacks);

  // 2) Business mobile lines
  const lineId = c.segment === "multi" || c.segment === "mfg" ? "P08" : "P07";
  tryAdd(lineId, q.lines, `why.${lineId}`, { core: true });

  // 3) What the owner asked for
  const NEED_ITEMS: Record<Need, [string, number, string[]?][]> = {
    payments: [["P19", q.counters]],
    whatsapp: [["P15", 1]],
    email: [["P16", q.users]],
    backup: [["P17", 1]],
    cctv: [["P23", q.cameras]],
    calls: [["P12", q.channels, ["P13"]]],
    tollfree: [["P13", 1]],
    website: [["P18", 1]],
    security: c.employees >= 10 && c.segment !== "multi" ? [["P20", q.devices], ["P21", 1]] : [["P20", q.devices]],
    wifi: [["P22", c.sites]],
    machines: [["P24", q.machines]],
    fleet: [["P25", q.vehicles]],
    uptime: c.segment === "multi" && c.sites >= 3 ? [["P09", c.sites], ["P10", c.sites]] : [["P09", c.sites]],
    sms: [["P14", 1]],
    remote: [["P11", 1]],
  };

  const asked = new Set(p.needs);
  for (const need of p.needs) {
    for (const [id, qty, fb] of NEED_ITEMS[need]) {
      if (need === "remote" && ["P05", "P06"].some(has)) continue; // leased lines come with a fixed IP
      tryAdd(id, qty, `why.${id}`, { core: true, need }, fb ?? []);
    }
  }

  // 4) Suggested add-ons (off by default) — popular for this business type / segment
  const type = BUSINESS_TYPES.find((b) => b.key === p.businessType);
  const suggestions: Need[] = [...(type?.needs ?? [])];
  if (c.segment === "prof") suggestions.push("uptime", "security", "backup");
  if (c.segment === "multi") suggestions.push("uptime", "wifi");
  if (c.segment === "mfg") suggestions.push("uptime", "email");
  if (c.segment === "micro") suggestions.push("website");
  let added = 0;
  for (const need of suggestions) {
    if (asked.has(need) || added >= 4) continue;
    for (const [id, qty] of NEED_ITEMS[need]) {
      if (has(id)) continue;
      if (tryAdd(id, qty, `why.${id}`, { core: false, need })) added++;
    }
  }

  // 5) Dependency locks: connectivity can't be dropped while something needs it
  for (const l of lines) {
    const deps = PRODUCTS[l.id].requiresOneOf;
    if (!deps.length) continue;
    const host = lines.find((h) => deps.includes(h.id) && h.core);
    if (host) host.lockedBy = [...(host.lockedBy ?? []), l.id];
  }

  // Order: connectivity, lines, then catalogue order
  const rank = (id: string) => (CONNECTIVITY.includes(id) ? 0 : id === "P07" || id === "P08" ? 1 : 2);
  lines.sort((a, b) => rank(a.id) - rank(b.id) || Number(b.core) - Number(a.core) || a.id.localeCompare(b.id));

  return { lines, blocked: dedupeBlocked(blocked), segment: c.segment };
}

function dedupeBlocked(b: Blocked[]) {
  const seen = new Set<string>();
  return b.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

export const CONNECTIVITY_IDS = CONNECTIVITY;
