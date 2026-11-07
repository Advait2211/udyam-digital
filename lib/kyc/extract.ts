// Turns OCR text of the four specimen document types into structured fields.
// Works on Tesseract output where label and value share a line ("GSTIN 37ABC...")
// and where the value sits on the next line (signatory IDs).

export type DocType = "gst" | "udyam" | "id" | "address";
export const DOC_TYPES: DocType[] = ["gst", "udyam", "id", "address"];

export interface Extracted {
  type: DocType;
  detectedType?: DocType;
  fields: Record<string, string>;
  confidence?: number;
}

const NOISE = /specimen|synthetic|not a valid|hackathon|fictional|format for|test data|^[^A-Za-z0-9]*$/i;

const LABELS: Record<DocType, [string, RegExp][]> = {
  gst: [
    ["gstin", /^gstin\b/i],
    ["legalName", /^legal\s*name/i],
    ["tradeName", /^trade\s*name/i],
    ["constitution", /^constitution/i],
    ["address", /^address\s*of\s*princip\w*/i],
    ["address2", /^\s*place\s*of\s*business/i],
    ["liabilityDate", /^date\s*of\s*liability/i],
    ["regType", /^type\s*of\s*registration/i],
  ],
  udyam: [
    ["udyamNumber", /^udyam\s*reg\w*\.?\s*(number|no\.?)/i],
    ["enterpriseName", /^enterprise\s*name/i],
    ["activity", /^major\s*activity/i],
    ["city", /^city\b/i],
    ["state", /^state\b/i],
    ["registeredOn", /^date\s*of\s*registration/i],
  ],
  id: [
    ["name", /^name\b/i],
    ["designation", /^designation/i],
    ["business", /^for\s*business/i],
    ["idNo", /^id\s*no\.?/i],
    ["validTill", /^valid\s*till/i],
  ],
  address: [
    ["consumerNo", /^consumer\s*no\.?/i],
    ["billedTo", /^billed\s*to/i],
    ["address", /^supply\s*address/i],
    ["billDate", /^bill\s*date/i],
    ["units", /^units\s*consumed/i],
    ["amount", /^amount\s*due(\s*\(inr\))?/i],
  ],
};

export function detectType(text: string): DocType | undefined {
  if (/gst\s*registration/i.test(text) || /\bGSTIN\b/.test(text)) return "gst";
  if (/udyam/i.test(text)) return "udyam";
  if (/signatory|designation/i.test(text)) return "id";
  if (/electricity|consumer\s*no|bill\s*date|supply\s*address/i.test(text)) return "address";
  return undefined;
}

function clean(v: string) {
  return v.replace(/^[\s:;,.\-–|]+/, "").replace(/[\s|]+$/, "").trim();
}

export function extractFields(type: DocType, text: string): Extracted {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !NOISE.test(l));
  const labels = LABELS[type];
  const isLabel = (l: string) => labels.some(([, re]) => re.test(l));
  const fields: Record<string, string> = {};
  const used = new Set<number>();

  lines.forEach((line, i) => {
    for (const [key, re] of labels) {
      const m = line.match(re);
      if (!m) continue;
      let value = clean(line.slice(m[0].length));
      if (!value && i + 1 < lines.length && !isLabel(lines[i + 1])) {
        value = clean(lines[i + 1]);
        used.add(i + 1);
      }
      if (value && !fields[key]) fields[key] = value;
      used.add(i);
      break;
    }
  });

  // Continuation lines after an address (e.g. "ndhra Pradesh - 118383" or a bare PIN)
  if (type === "gst" && fields.address) {
    const second = fields.address2 ?? "";
    fields.address = joinWrapped(fields.address, second);
    delete fields.address2;
  }
  if (type === "address" && fields.address) {
    const idx = lines.findIndex((l) => /^supply\s*address/i.test(l));
    const next = lines[idx + 1];
    if (next && !isLabel(next) && !used.has(idx + 1)) fields.address = joinWrapped(fields.address, clean(next));
  }

  if (fields.gstin) fields.gstin = fields.gstin.replace(/\s+/g, "").toUpperCase();
  if (fields.udyamNumber) {
    const u = fields.udyamNumber.replace(/\s+/g, "").toUpperCase();
    fields.udyamNumber = /UDYAM/.test(u) ? u : "";
    if (!fields.udyamNumber) delete fields.udyamNumber;
  }
  for (const k of ["liabilityDate", "registeredOn", "validTill", "billDate"]) {
    if (fields[k]) {
      const d = fields[k].match(/(\d{4})\s*-\s*(\d{2})\s*-\s*(\d{2})/);
      fields[k] = d ? `${d[1]}-${d[2]}-${d[3]}` : fields[k];
    }
  }
  return { type, detectedType: detectType(text), fields };
}

function joinWrapped(a: string, b: string) {
  if (!b) return a;
  const lastToken = a.split(/[\s,]+/).pop() ?? "";
  // "…Visakhapatnam, A" + "ndhra Pradesh - 118383" → glue the split word back
  if (lastToken.length <= 3 && /^[a-z]/.test(b)) return a + b;
  return `${a} ${b}`.replace(/\s+-\s*-+/, " -").replace(/\s{2,}/g, " ");
}

export function normName(s: string | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(llp|pvtltd|privatelimited|ltd)$/, "");
}

export function normAddr(s: string | undefined) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "Neha Kaur (Prop. Vindhya Tours & Travels)" → { person: "Neha Kaur", business: "Vindhya Tours & Travels" } */
export function splitProprietor(legal: string | undefined) {
  const m = (legal ?? "").match(/^(.*?)\s*\(\s*prop\.?\s*(.*?)\)?\s*$/i);
  return m ? { person: m[1].trim(), business: m[2].trim() } : undefined;
}
