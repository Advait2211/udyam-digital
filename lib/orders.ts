import "server-only";
import { PRODUCTS } from "./catalogue";
import { db } from "./db";
import type { BundleLine, Profile } from "./types";

export interface OrderRow {
  id: string;
  created_at: number;
  lang: string;
  business: string | null;
  gstin_masked: string | null;
  profile: string;
  lines: string;
  contract: number;
  monthly: number;
  setup: number;
  consent_id: string | null;
  kyc_verdict: string | null;
  slot: string | null;
  offset_hours: number;
}

export type ServiceStatus = "pending" | "scheduled" | "installing" | "live";
const H = 3600_000;

export function getOrder(id: string): OrderRow | undefined {
  return db().prepare("SELECT * FROM orders WHERE id = ?").get(id.toUpperCase()) as OrderRow | undefined;
}

/** Status is derived from time, so the tracker is always truthful — no manual updates needed for the demo. */
export function orderView(o: OrderRow) {
  const now = Date.now() + o.offset_hours * H;
  const lines = (JSON.parse(o.lines) as BundleLine[]).filter((l) => l.on);
  const slot = o.slot ? JSON.parse(o.slot) as { date: string; window: string } : null;
  const start = o.created_at;
  const services = lines.map((l) => {
    const p = PRODUCTS[l.id];
    const due = start + p.installDays * 24 * H;
    const status: ServiceStatus = now >= due ? "live" : now >= due - 24 * H ? "installing" : slot || p.installDays <= 1 ? "scheduled" : "pending";
    return { id: l.id, qty: l.qty, installDays: p.installDays, due, status };
  });
  const lastDue = Math.max(start + 24 * H, ...services.map((s) => s.due));
  const firstDue = Math.min(...services.map((s) => s.due));
  const raw = [
    { key: "placed", at: start, done: true },
    { key: "kyc", at: start + 60_000, done: now >= start + 60_000 },
    { key: "scheduled", at: start + 2 * H, done: !!slot || now >= start + 2 * H },
    { key: "installing", at: firstDue - 24 * H, done: now >= firstDue - 24 * H },
    { key: "installed", at: firstDue, done: now >= firstDue },
    { key: "active", at: lastDue, done: now >= lastDue },
  ];
  // Stages happen in order: a next-day SIM must not show "technician on the way" before KYC is done.
  const stages = raw.reduce<typeof raw>((acc, s) => {
    const prev = acc[acc.length - 1];
    acc.push(prev ? { ...s, at: Math.max(s.at, prev.at), done: s.done && prev.done } : s);
    return acc;
  }, []);
  const current = [...stages].reverse().find((s) => s.done)?.key ?? "placed";
  return {
    id: o.id,
    createdAt: o.created_at,
    now,
    business: o.business,
    gstinMasked: o.gstin_masked,
    contract: o.contract,
    monthly: o.monthly,
    setup: o.setup,
    lang: o.lang,
    kycVerdict: o.kyc_verdict,
    slot,
    eta: lastDue,
    stages,
    current,
    services,
    profile: JSON.parse(o.profile) as Profile,
    technician: { name: "Ramesh Patil", rating: 4.8, phoneMasked: "98•••••214" },
  };
}

export type OrderView = ReturnType<typeof orderView>;
