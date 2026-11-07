import { completeJSON } from "@/lib/ai/router";
import { parseFreeText } from "@/lib/engine/parse";
import type { Lang, Need, Profile } from "@/lib/types";
import { BUSINESS_TYPES, NEEDS } from "@/lib/catalogue";

const TYPES = BUSINESS_TYPES.map((b) => b.key);
const NEED_KEYS = NEEDS.map((n) => n.key);
const MENTIONS_WIRED = /fib(re|er)|cable|wired|broadband|फाइबर|फायबर|केबल|ब्रॉडब/i;

/** Free text → profile fields. Rules run first (instant); AI only fills gaps when a key is configured. */
export async function POST(req: Request) {
  const { text, lang = "en" } = (await req.json()) as { text: string; lang?: Lang };
  const rules = parseFreeText(String(text ?? "").slice(0, 600));
  const ai = await completeJSON<Partial<Profile> & { needs?: string[] }>(lang, [
    {
      role: "system",
      content:
        `Extract a small-business profile from the owner's message (any Indian language). Reply with JSON only: ` +
        `{"businessType": one of ${JSON.stringify(TYPES)} or null, "employees": int or null, "sites": int or null, "city": string or null, ` +
        `"hasGstin": true/false/null, "noFibre": true/false/null, "needs": subset of ${JSON.stringify(NEED_KEYS)}}. Never guess numbers.`,
    },
    { role: "user", content: String(text).slice(0, 600) },
  ], 3000);

  const patch: Partial<Profile> = { ...rules.patch };
  let source: "rules" | "ai+rules" = "rules";
  if (ai) {
    source = "ai+rules";
    if (!patch.businessType && ai.businessType && TYPES.includes(ai.businessType)) patch.businessType = ai.businessType;
    if (!patch.employees && Number.isInteger(ai.employees) && ai.employees! > 0) patch.employees = ai.employees!;
    if (!patch.sites && Number.isInteger(ai.sites) && ai.sites! > 0) patch.sites = ai.sites!;
    if (patch.hasGstin === undefined && typeof ai.hasGstin === "boolean") patch.hasGstin = ai.hasGstin;
    // Only when the owner actually talked about wired internet: a guessed "no fibre" silently swaps fibre for AirFiber.
    if (!patch.noFibre && ai.noFibre === true && MENTIONS_WIRED.test(String(text))) patch.noFibre = true;
    const extra = (ai.needs ?? []).filter((n): n is Need => NEED_KEYS.includes(n as Need));
    if (extra.length) patch.needs = [...new Set([...(patch.needs ?? []), ...extra])];
    if (!patch.city && ai.city) patch.city = String(ai.city);
  }
  return Response.json({ patch, source });
}
