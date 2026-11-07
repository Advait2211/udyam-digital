import { chatTurn, type ChatState } from "@/lib/chatbot";
import { db, logEvent, newId } from "@/lib/db";
import { priceQuote } from "@/lib/engine/pricing";
import { recommend } from "@/lib/engine/recommend";
import { scoreLead } from "@/lib/propensity";

/**
 * Conversational front end. Same contract a WhatsApp Cloud API webhook would use:
 * { from, text } or { from, optionId } in → bot messages (text / buttons / list) out.
 * The in-app phone simulator calls this; pointing Meta's webhook here needs only a thin adapter.
 */
export async function POST(req: Request) {
  const { from, text, optionId } = (await req.json()) as { from?: string; text?: string; optionId?: string };
  const sid = from || newId("WA", 8);
  const row = db().prepare("SELECT state FROM chat_sessions WHERE id = ?").get(sid) as { state: string } | undefined;
  const prev = row ? (JSON.parse(row.state) as ChatState) : null;
  const origin = new URL(req.url).origin;
  const { state, replies, handoff } = chatTurn(prev, { text, optionId }, origin);
  db().prepare("INSERT INTO chat_sessions (id, updated_at, state) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, state = excluded.state").run(sid, Date.now(), JSON.stringify(state));
  if (handoff) {
    const p = { ...state.profile, gstin: undefined };
    const id = newId("DL", 5);
    db()
      .prepare("INSERT INTO leads (id, created_at, lang, kind, stage, profile, monthly, score) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, Date.now(), state.lang, "chat", state.step, JSON.stringify(p), priceQuote(recommend(p).lines.filter((l) => l.on), 12).monthly, scoreLead(p, state.lang, "WhatsApp campaign"));
    logEvent("lead.created", id, { kind: "chat" });
  }
  logEvent("chat.turn", sid, { step: state.step });
  return Response.json({ from: sid, lang: state.lang, step: state.step, replies });
}
