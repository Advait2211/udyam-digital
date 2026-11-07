import { connection } from "next/server";
import callList from "@/lib/generated/call_list.json";
import { db } from "@/lib/db";

interface DbLead { id: string; created_at: number; lang: string; kind: string; stage: string; profile: string; monthly: number; score: number; status: string; assigned: string | null; note: string | null }

export async function GET() {
  await connection();
  const live = (db().prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200").all() as unknown as DbLead[]).map((l) => ({ ...l, profile: JSON.parse(l.profile) }));
  return Response.json({ live, dataset: callList });
}
