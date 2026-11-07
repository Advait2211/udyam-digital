import { PRODUCTS } from "@/lib/catalogue";
import { db, logEvent, newId } from "@/lib/db";
import { minContractFor, priceQuote } from "@/lib/engine/pricing";
import { contextFor, eligible } from "@/lib/engine/recommend";
import { maskId } from "@/lib/kyc/gstin";
import type { BundleLine, Profile } from "@/lib/types";

/** Places an order. Prices and eligibility are recomputed here — the client is never trusted for either. */
export async function POST(req: Request) {
  const body = (await req.json()) as { profile: Profile; lines: BundleLine[]; contract: number; consentId?: string; kycVerdict?: string; business?: string; gstin?: string; lang?: string; nonGstOnly?: boolean };
  const profile = body.nonGstOnly ? { ...body.profile, hasGstin: false } : body.profile;
  const ctx = contextFor(profile);
  const lines = (body.lines ?? [])
    .filter((l) => PRODUCTS[l.id] && l.on && l.qty > 0 && l.qty <= 500)
    .filter((l) => eligible(l.id, ctx).ok)
    .map((l) => ({ ...l, qty: Math.round(l.qty) }));
  if (!lines.length) return Response.json({ error: "empty bundle" }, { status: 400 });
  if (!body.consentId) return Response.json({ error: "consent required" }, { status: 400 });
  const contract = Math.max(Number(body.contract) || 12, minContractFor(lines));
  const q = priceQuote(lines, contract);
  const id = newId("ACC", 6);
  db()
    .prepare("INSERT INTO orders (id, created_at, lang, business, gstin_masked, profile, lines, contract, monthly, setup, consent_id, kyc_verdict) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, Date.now(), body.lang ?? "en", body.business ?? null, body.gstin ? maskId(body.gstin, 4, 3) : null, JSON.stringify({ ...profile, gstin: undefined }), JSON.stringify(lines), contract, q.monthly, q.setup, body.consentId, body.kycVerdict ?? null);
  logEvent("order.placed", id, { monthly: q.monthly, items: lines.length });
  return Response.json({ id, monthly: q.monthly, setup: q.setup, contract });
}
