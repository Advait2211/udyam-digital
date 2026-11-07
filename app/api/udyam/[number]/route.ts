import { connection } from "next/server";
import { udyamLookup } from "@/lib/kyc/registry";

/** Mock Udyam lookup API backed by mock_udyam_registry.csv. */
export async function GET(_req: Request, ctx: RouteContext<"/api/udyam/[number]">) {
  await connection();
  const { number } = await ctx.params;
  const r = udyamLookup(decodeURIComponent(number));
  if (!r.valid) return Response.json({ valid: false });
  if (!r.record) return Response.json({ valid: true, number: r.number, found: false });
  const { name, type, activity, state, city } = r.record;
  return Response.json({ valid: true, number: r.number, found: true, name, type, activity, state, city });
}
