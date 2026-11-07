import { textToSpeech } from "@/lib/ai/router";
import type { Lang } from "@/lib/types";

export async function POST(req: Request) {
  const { text, lang = "hi" } = (await req.json()) as { text: string; lang?: Lang };
  const audio = await textToSpeech(String(text ?? ""), lang);
  if (!audio) return new Response(null, { status: 501 });
  return Response.json({ audio });
}
