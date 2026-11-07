import { speechToText } from "@/lib/ai/router";
import type { Lang } from "@/lib/types";

export async function POST(req: Request) {
  const fd = await req.formData();
  const audio = fd.get("audio");
  const lang = (fd.get("lang") as Lang) ?? "hi";
  if (!(audio instanceof Blob)) return Response.json({ error: "no audio" }, { status: 400 });
  const text = await speechToText(audio, lang);
  if (!text) return new Response(null, { status: 501 });
  return Response.json({ text });
}
