import { connection } from "next/server";
import insights from "@/lib/generated/insights.json";
import { db } from "@/lib/db";
import { PROPENSITY_META } from "@/lib/propensity";
import { aiStatus } from "@/lib/ai/router";

export async function GET() {
  await connection();
  const d = db();
  const count = (sql: string) => (d.prepare(sql).get() as { n: number }).n;
  const live = {
    orders: count("SELECT COUNT(*) AS n FROM orders"),
    leads: count("SELECT COUNT(*) AS n FROM leads"),
    consents: count("SELECT COUNT(*) AS n FROM consents"),
    kycRuns: count("SELECT COUNT(*) AS n FROM events WHERE type = 'kyc.verify'"),
    lookups: count("SELECT COUNT(*) AS n FROM events WHERE type = 'gstin.lookup'"),
    mrr: (d.prepare("SELECT COALESCE(SUM(monthly),0) AS n FROM orders").get() as { n: number }).n,
    recentOrders: d.prepare("SELECT id, created_at, business, monthly, lang FROM orders ORDER BY created_at DESC LIMIT 8").all(),
    events: d.prepare("SELECT at, type, ref FROM events ORDER BY id DESC LIMIT 12").all(),
  };
  return Response.json({ insights, live, model: PROPENSITY_META, ai: aiStatus() });
}
