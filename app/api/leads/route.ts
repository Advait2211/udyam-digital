import { db, logEvent, newId } from "@/lib/db";
import { priceQuote } from "@/lib/engine/pricing";
import { recommend } from "@/lib/engine/recommend";
import { scoreLead } from "@/lib/propensity";
import type { Lang, Profile } from "@/lib/types";

/** Leads the digital journey hands to people: callback requests and journeys that stalled. */
export async function POST(req: Request) {
  const { profile, lang = "en", kind = "callback", stage = "advisor", note } = (await req.json()) as { profile: Profile; lang?: Lang; kind?: string; stage?: string; note?: string };
  const p: Profile = { ...profile, gstin: undefined };
  const monthly = priceQuote(recommend(p).lines.filter((l) => l.on), 12).monthly;
  const score = scoreLead(p, lang, kind === "chat" ? "WhatsApp campaign" : "Website form");
  const id = newId("DL", 5);
  db().prepare("INSERT INTO leads (id, created_at, lang, kind, stage, profile, monthly, score, note) VALUES (?,?,?,?,?,?,?,?,?)").run(id, Date.now(), lang, kind, stage, JSON.stringify(p), monthly, score, note ?? null);
  logEvent("lead.created", id, { kind, stage });
  return Response.json({ id, score });
}
