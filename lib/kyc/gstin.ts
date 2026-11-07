// GSTIN: 2-digit state + 10-char PAN + entity no. + 'Z' + check character.
// The hackathon PANs use 'X' as the 4th character (not a real entity type) — accepted here.

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export function checkChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function gstinFormatOk(g: string) {
  return GSTIN_RE.test(g);
}

export function gstinChecksumOk(g: string) {
  return gstinFormatOk(g) && checkChar(g.slice(0, 14)) === g[14];
}

export type GstinValidity =
  | { ok: true; gstin: string; state: string }
  | { ok: false; gstin: string; reason: "length" | "format" | "checksum" | "state"; expected?: string };

export function validateGstin(input: string): GstinValidity {
  const g = input.replace(/[\s-]/g, "").toUpperCase();
  if (g.length !== 15) return { ok: false, gstin: g, reason: "length" };
  if (!GSTIN_RE.test(g)) return { ok: false, gstin: g, reason: "format" };
  const state = GST_STATES[g.slice(0, 2)];
  if (!state) return { ok: false, gstin: g, reason: "state" };
  const exp = checkChar(g.slice(0, 14));
  if (exp !== g[14]) return { ok: false, gstin: g, reason: "checksum", expected: exp };
  return { ok: true, gstin: g, state };
}

// ---------- OCR helpers ----------
const DIGIT_POS = [0, 1, 7, 8, 9, 10];
const LETTER_POS = [2, 3, 4, 5, 6, 11];
const TO_DIGIT: Record<string, string> = { O: "0", D: "0", Q: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6", T: "7" };
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G", "7": "T" };

/** Fix characters that can only be digits or only letters at a given position. */
export function normalizeOcrGstin(raw: string): string {
  const g = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 15).split("");
  for (const i of DIGIT_POS) if (g[i] && TO_DIGIT[g[i]]) g[i] = TO_DIGIT[g[i]];
  for (const i of LETTER_POS) if (g[i] && TO_LETTER[g[i]]) g[i] = TO_LETTER[g[i]];
  if (g[13] && (g[13] === "2" || g[13] === "7")) g[13] = "Z";
  return g.join("");
}

/** Pairs a camera/OCR engine commonly confuses. Deliberately excludes e.g. 5↔8 (a real typo, not a misread). */
const CONFUSABLE: Record<string, string[]> = {
  "0": ["O", "D", "Q"], O: ["0", "D", "Q"], D: ["O", "0"], Q: ["O", "0"],
  "1": ["I", "L", "J", "T"], I: ["1", "L", "J", "T"], L: ["I", "1"], J: ["I", "1", "T"], T: ["I", "1", "J"],
  "2": ["Z"], Z: ["2"], "5": ["S"], S: ["5"], "8": ["B"], B: ["8"], "6": ["G"], G: ["6"],
  U: ["V"], V: ["U"], M: ["N"], N: ["M"], K: ["X"], X: ["K"], E: ["F"], F: ["E"], C: ["G"], P: ["R"], R: ["P"],
};

/** Valid GSTINs reachable from an OCR read by ≤2 confusable-character swaps. */
export function ocrCandidates(read: string): string[] {
  const base = normalizeOcrGstin(read);
  if (base.length !== 15) return [];
  if (gstinChecksumOk(base)) return [base];
  const out = new Set<string>();
  const swaps = (s: string) => {
    const res: string[] = [];
    for (let i = 0; i < 15; i++) for (const alt of CONFUSABLE[s[i]] ?? []) res.push(s.slice(0, i) + alt + s.slice(i + 1));
    return res;
  };
  for (const one of swaps(base)) {
    if (gstinChecksumOk(one)) out.add(one);
    for (const two of swaps(one)) if (gstinChecksumOk(two)) out.add(two);
  }
  return [...out];
}

export function maskId(s: string | undefined, start = 4, end = 3) {
  if (!s) return "";
  if (s.length <= start + end) return s;
  return s.slice(0, start) + "•".repeat(Math.max(3, s.length - start - end)) + s.slice(-end);
}
