import "server-only";
import gstJson from "../generated/gstin_registry.json";
import udyamJson from "../generated/udyam_registry.json";
import { normName } from "./extract";
import { validateGstin } from "./gstin";

export interface GstRecord {
  legalName: string;
  tradeName: string;
  constitution: string;
  address: string;
  state: string;
  registeredOn: string;
  status: "Active" | "Cancelled" | "Suspended";
}
export interface UdyamRecord {
  name: string;
  type: string;
  activity: string;
  nic: string;
  state: string;
  city: string;
  registeredOn: string;
}

const GST = gstJson as Record<string, GstRecord | undefined>;
const UDYAM = udyamJson as Record<string, UdyamRecord | undefined>;

const gstByName = new Map<string, string[]>();
for (const [g, r] of Object.entries(GST)) {
  if (!r) continue;
  for (const n of new Set([normName(r.legalName), normName(r.tradeName)])) {
    gstByName.set(n, [...(gstByName.get(n) ?? []), g]);
  }
}
const udyamByName = new Map<string, string[]>();
for (const [u, r] of Object.entries(UDYAM)) {
  if (!r) continue;
  const n = normName(r.name);
  udyamByName.set(n, [...(udyamByName.get(n) ?? []), u]);
}

export function gstLookup(gstin: string) {
  const v = validateGstin(gstin);
  if (!v.ok) return { valid: false as const, validity: v };
  const rec = GST[v.gstin];
  return { valid: true as const, gstin: v.gstin, stateFromCode: v.state, record: rec ?? null };
}

export function gstRecord(gstin: string): GstRecord | undefined {
  return GST[gstin];
}

export function gstByBusinessName(name: string, state?: string): string[] {
  const hits = gstByName.get(normName(name)) ?? [];
  return state ? hits.filter((g) => GST[g]?.state.toLowerCase() === state.toLowerCase()) : hits;
}

export const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export function udyamLookup(no: string) {
  const n = no.replace(/\s+/g, "").toUpperCase();
  if (!UDYAM_RE.test(n)) return { valid: false as const, number: n };
  return { valid: true as const, number: n, record: UDYAM[n] ?? null };
}

export function udyamByBusinessName(name: string, state?: string): string[] {
  const hits = udyamByName.get(normName(name)) ?? [];
  return state ? hits.filter((u) => UDYAM[u]?.state.toLowerCase() === state.toLowerCase()) : hits;
}

export function udyamRecord(no: string): UdyamRecord | undefined {
  return UDYAM[no];
}
