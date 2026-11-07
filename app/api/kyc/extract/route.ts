import { visionRead } from "@/lib/ai/router";

/** Optional AI document reading (NVIDIA NIM vision). 501 → the browser's on-device OCR is used. */
export async function POST(req: Request) {
  const { image } = (await req.json()) as { image: string };
  if (!image?.startsWith("data:image/")) return Response.json({ error: "bad image" }, { status: 400 });
  const text = await visionRead(image);
  if (!text) return new Response(null, { status: 501 });
  return Response.json({ text });
}
