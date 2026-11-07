import { connection } from "next/server";
import { aiStatus } from "@/lib/ai/router";

export async function GET() {
  await connection();
  return Response.json({ ok: true, ai: aiStatus() });
}
