import { streamChat } from "@/lib/ai/router";
import { PRODUCTS } from "@/lib/catalogue";
import { inr, priceQuote } from "@/lib/engine/pricing";
import { recommend } from "@/lib/engine/recommend";
import type { Lang, Profile } from "@/lib/types";

const LANG_NAME: Record<Lang, string> = { en: "simple English", hi: "simple Hindi (Devanagari)", mr: "simple Marathi (Devanagari)" };

/**
 * Streams a plain-language explanation of the deterministic bundle.
 * 204 = no AI configured or too slow → the client shows its instant template instead.
 */
export async function POST(req: Request) {
  const { profile, lang = "en" } = (await req.json()) as { profile: Profile; lang?: Lang };
  const r = recommend(profile);
  const core = r.lines.filter((l) => l.on);
  const q = priceQuote(core, 12);
  const facts = {
    business: profile.businessType, staff: profile.employees, locations: profile.sites, city: profile.city, hasGstin: profile.hasGstin,
    asked: profile.needs,
    bundle: core.map((l) => ({ product: PRODUCTS[l.id].name, what: PRODUCTS[l.id].description, qty: l.qty })),
    notPossible: r.blocked.filter((b) => !b.alt).map((b) => ({ product: PRODUCTS[b.id].name, rule: b.reason, ...b.params })),
    monthlyPrice: inr(q.monthly), readyInDays: q.maxInstallDays,
  };
  const stream = await streamChat(lang, [
    {
      role: "system",
      content:
        `You are a warm, honest telecom advisor for Indian small-business owners. In ${LANG_NAME[lang]}, write 3–4 short sentences explaining why this bundle fits. ` +
        `Use ONLY the facts given — never invent products, prices or discounts. Mention the monthly price exactly as given. ` +
        `If something is not possible, say why kindly (e.g. needs an active GSTIN). No markdown, no bullet points.`,
    },
    { role: "user", content: JSON.stringify(facts) },
  ]);
  if (!stream) return new Response(null, { status: 204 });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-AI": "1" } });
}
