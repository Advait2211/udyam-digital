import { connection } from "next/server";
import { gstLookup } from "@/lib/kyc/registry";
import { logEvent } from "@/lib/db";
import { maskId } from "@/lib/kyc/gstin";

/** Mock GSTIN lookup API backed by mock_gstin_registry.csv. */
export async function GET(_req: Request, ctx: RouteContext<"/api/gstin/[gstin]">) {
  await connection();
  const { gstin } = await ctx.params;
  const r = gstLookup(decodeURIComponent(gstin));
  logEvent("gstin.lookup", maskId(gstin.toUpperCase(), 4, 3), { valid: r.valid, found: r.valid && !!r.record });
  if (!r.valid) return Response.json({ valid: false, reason: r.validity.reason, expected: r.validity.reason === "checksum" ? r.validity.expected : undefined });
  if (!r.record) return Response.json({ valid: true, gstin: r.gstin, state: r.stateFromCode, found: false });
  // Data minimisation: return only what the journey needs
  const { legalName, tradeName, constitution, state, status, registeredOn } = r.record;
  return Response.json({ valid: true, gstin: r.gstin, found: true, legalName, tradeName, constitution, state, status, registeredOn });
}
