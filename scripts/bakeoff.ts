/**
 * Model bake-off — run once API keys are in .env.local:
 *   npx tsx --env-file=.env.local scripts/bakeoff.ts
 * Times each candidate on advisor prompts (first token, total, valid JSON, correct fields)
 * and each vision candidate on the KYC specimens, then prints a ranking.
 */
import fs from "node:fs";
import path from "node:path";
import { extractFields, type DocType } from "../lib/kyc/extract";

const NIM = process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
const KEY = process.env.NVIDIA_API_KEY;
const SARVAM = process.env.SARVAM_API_KEY;

const CHAT = ["deepseek-ai/deepseek-v4.1-flash", "nvidia/nemotron-3.5-lightning-30b-a3b", "google/gemma-4-31b-it", "openai/gpt-oss-20b"];
const VISION = ["nvidia/nemotron-3.5-super-vl-120b-a12b", "meta/llama-3.2-90b-vision-instruct"];

const PROMPTS: [string, Record<string, unknown>][] = [
  ["I run a kirana store in Pune with 3 staff, want UPI billing, GST registered", { businessType: "kirana", employees: 3, hasGstin: true }],
  ["Dental clinic in Kochi, 8 people, no GST yet", { businessType: "clinic", employees: 8, hasGstin: false }],
  ["Restaurant chain, 6 outlets in Bengaluru, 60 staff", { businessType: "chain", sites: 6, employees: 60 }],
  ["Textile unit in Surat with 40 workers, need machine monitoring", { businessType: "factory", employees: 40 }],
  ["मेरी नागपुर में दवाई की दुकान है, 2 लोग, जीएसटी नहीं", { businessType: "pharmacy", employees: 2, hasGstin: false }],
  ["माझे पुण्यात सलून आहे, 4 जण, WhatsApp हवे", { businessType: "salon", employees: 4 }],
  ["CA firm in Mumbai, 18 people, need email and backup", { businessType: "office", employees: 18 }],
  ["Coaching classes in Patna, 5 teachers, customer wifi", { businessType: "coaching", employees: 5 }],
  ["Bakery in Lucknow with 3 delivery vans", { businessType: "bakery" }],
  ["Gym chain 4 locations Chennai 25 staff", { businessType: "chain", sites: 4, employees: 25 }],
];
const SYSTEM = 'Extract JSON only: {"businessType": one of [kirana,pharmacy,salon,bakery,boutique,restaurant,clinic,office,coaching,chain,factory] or null, "employees": int|null, "sites": int|null, "city": string|null, "hasGstin": bool|null}';

async function chat(base: string, headers: Record<string, string>, model: string, user: string) {
  const t0 = performance.now();
  let first = 0;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, stream: true, temperature: 0, max_tokens: 200, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok || !res.body) throw new Error(`${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data:") || line.includes("[DONE]")) continue;
      try {
        const d = JSON.parse(line.slice(5)).choices?.[0]?.delta?.content ?? "";
        if (d && !first) first = performance.now() - t0;
        text += d;
      } catch {}
    }
  }
  return { first, total: performance.now() - t0, text: text.replace(/<think>[\s\S]*?<\/think>/g, "") };
}

async function runChat(name: string, base: string, headers: Record<string, string>, model: string) {
  let ok = 0, json = 0, first = 0, total = 0, n = 0;
  for (const [p, want] of PROMPTS) {
    try {
      const r = await chat(base, headers, model, p);
      n++; first += r.first; total += r.total;
      const m = r.text.match(/\{[\s\S]*\}/);
      if (!m) continue;
      json++;
      const got = JSON.parse(m[0]);
      if (Object.entries(want).every(([k, v]) => got[k] === v)) ok++;
    } catch (e) {
      console.log(`  ${model}: ${(e as Error).message}`);
    }
  }
  console.log(`${name.padEnd(48)} first-token ${(first / Math.max(n, 1)).toFixed(0)} ms · total ${(total / Math.max(n, 1)).toFixed(0)} ms · JSON ${json}/${PROMPTS.length} · correct ${ok}/${PROMPTS.length}`);
}

async function runVision(model: string) {
  const dir = path.join(__dirname, "..", "public", "samples");
  const cases: [string, DocType][] = [["K03_gst_certificate.png", "gst"], ["K10_gst_certificate.png", "gst"], ["K07_address_proof.png", "address"], ["K09_udyam_certificate.png", "udyam"]];
  let read = 0, ms = 0;
  for (const [f, type] of cases) {
    const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
    const t0 = performance.now();
    const res = await fetch(`${NIM}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 400, messages: [{ role: "user", content: [{ type: "text", text: "Transcribe this document as 'Label Value' lines." }, { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }] }] }),
      signal: AbortSignal.timeout(30000),
    }).catch(() => null);
    ms += performance.now() - t0;
    if (!res?.ok) continue;
    const text = (await res.json()).choices?.[0]?.message?.content ?? "";
    if (Object.keys(extractFields(type, text).fields).length >= 4) read++;
  }
  console.log(`${model.padEnd(48)} avg ${(ms / cases.length).toFixed(0)} ms · fields read on ${read}/${cases.length} documents`);
}

(async () => {
  if (!KEY && !SARVAM) return console.log("No keys in env — add NVIDIA_API_KEY / SARVAM_API_KEY to .env.local first.");
  if (KEY) {
    console.log("\nChat (NVIDIA NIM)");
    for (const m of CHAT) await runChat(m, NIM, { Authorization: `Bearer ${KEY}` }, m);
    console.log("\nVision (NVIDIA NIM)");
    for (const m of VISION) await runVision(m);
  }
  if (SARVAM) {
    console.log("\nChat (Sarvam)");
    await runChat("sarvam-m", "https://api.sarvam.ai/v1", { "api-subscription-key": SARVAM, Authorization: `Bearer ${SARVAM}` }, process.env.SARVAM_CHAT_MODEL || "sarvam-m");
  }
  console.log("\nPut the winners in .env.local as NIM_CHAT_MODEL / NIM_VISION_MODEL / SARVAM_CHAT_MODEL.");
})();
