import "server-only";
import type { Lang } from "../types";

/**
 * One small router for two providers:
 *  - NVIDIA NIM (OpenAI-compatible): English chat + document vision
 *  - Sarvam: Hindi/Marathi chat, speech-to-text, text-to-speech
 * Every call has a hard timeout and returns null on any failure, so the UI
 * always falls back to the instant rule-based path and never hangs.
 */

const NIM_BASE = process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
const NIM_CHAT = process.env.NIM_CHAT_MODEL || "deepseek-ai/deepseek-v4.1-flash";
const NIM_VISION = process.env.NIM_VISION_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";
const SARVAM_BASE = process.env.SARVAM_BASE_URL || "https://api.sarvam.ai";
const SARVAM_CHAT = process.env.SARVAM_CHAT_MODEL || "sarvam-m";
const SARVAM_STT = process.env.SARVAM_STT_MODEL || "saarika:v2.5";
const SARVAM_TTS = process.env.SARVAM_TTS_MODEL || "bulbul:v2";

const nimKey = () => (process.env.NVIDIA_API_KEY || "").trim();
const sarvamKey = () => (process.env.SARVAM_API_KEY || "").trim();

export function aiStatus() {
  return { nim: !!nimKey(), sarvam: !!sarvamKey(), chatModel: NIM_CHAT, visionModel: NIM_VISION, sarvamModel: SARVAM_CHAT };
}

type Msg = { role: "system" | "user" | "assistant"; content: string | unknown[] };

function provider(lang: Lang): { url: string; model: string; headers: Record<string, string>; name: string } | null {
  if ((lang === "hi" || lang === "mr") && sarvamKey())
    return { url: `${SARVAM_BASE}/v1/chat/completions`, model: SARVAM_CHAT, headers: { "api-subscription-key": sarvamKey(), Authorization: `Bearer ${sarvamKey()}` }, name: "sarvam" };
  if (nimKey()) return { url: `${NIM_BASE}/chat/completions`, model: NIM_CHAT, headers: { Authorization: `Bearer ${nimKey()}` }, name: "nim" };
  if (sarvamKey())
    return { url: `${SARVAM_BASE}/v1/chat/completions`, model: SARVAM_CHAT, headers: { "api-subscription-key": sarvamKey(), Authorization: `Bearer ${sarvamKey()}` }, name: "sarvam" };
  return null;
}

/** Streams plain text tokens. Returns null if no provider or the first token doesn't arrive in time. */
export async function streamChat(lang: Lang, messages: Msg[], opts: { firstTokenMs?: number; maxTokens?: number } = {}): Promise<ReadableStream<Uint8Array> | null> {
  const p = provider(lang);
  if (!p) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.firstTokenMs ?? 3500);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...p.headers },
      body: JSON.stringify({ model: p.model, messages, stream: true, temperature: 0.4, max_tokens: opts.maxTokens ?? 320 }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return null;
    clearTimeout(timer);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    let buf = "";
    let inThink = false;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) return controller.close();
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n");
        buf = events.pop() ?? "";
        for (const line of events) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (data === "[DONE]") return controller.close();
          try {
            let delta: string = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
            // Hide reasoning traces some models emit
            if (delta.includes("<think>")) inThink = true;
            if (inThink) {
              if (delta.includes("</think>")) { delta = delta.split("</think>").pop() ?? ""; inThink = false; } else continue;
            }
            if (delta) controller.enqueue(enc.encode(delta));
          } catch {
            /* ignore keep-alives */
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Non-streaming JSON completion with timeout. */
export async function completeJSON<T>(lang: Lang, messages: Msg[], timeoutMs = 3500): Promise<T | null> {
  const p = provider(lang);
  if (!p) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...p.headers },
      body: JSON.stringify({ model: p.model, messages, temperature: 0, max_tokens: 400 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a document image with the NIM vision model. Returns raw text lines or null. */
export async function visionRead(dataUrl: string, timeoutMs = 9000): Promise<string | null> {
  if (!nimKey()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey()}` },
      body: JSON.stringify({
        model: NIM_VISION,
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this document exactly as 'Label Value' lines, one field per line. Copy identifiers character by character. Output only the lines." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.choices?.[0]?.message?.content as string) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SARVAM_LANG: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export async function speechToText(audio: Blob, lang: Lang): Promise<string | null> {
  if (!sarvamKey()) return null;
  try {
    const fd = new FormData();
    fd.append("file", audio, "speech.webm");
    fd.append("model", SARVAM_STT);
    fd.append("language_code", SARVAM_LANG[lang]);
    const res = await fetch(`${SARVAM_BASE}/speech-to-text`, { method: "POST", headers: { "api-subscription-key": sarvamKey() }, body: fd, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return j.transcript ?? null;
  } catch {
    return null;
  }
}

export async function textToSpeech(text: string, lang: Lang): Promise<string | null> {
  if (!sarvamKey()) return null;
  try {
    const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-subscription-key": sarvamKey() },
      body: JSON.stringify({ text: text.slice(0, 1400), inputs: [text.slice(0, 480)], target_language_code: SARVAM_LANG[lang], model: SARVAM_TTS, speaker: process.env.SARVAM_SPEAKER || "anushka" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.audios?.[0] ?? null; // base64 wav
  } catch {
    return null;
  }
}
