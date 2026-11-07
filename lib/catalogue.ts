import catalogueJson from "./generated/catalogue.json";
import citiesJson from "./generated/cities.json";
import type { Need, Product, Segment } from "./types";

export const CATALOGUE = catalogueJson as Product[];
export const PRODUCTS: Record<string, Product> = Object.fromEntries(CATALOGUE.map((p) => [p.id, p]));
export const CITIES = citiesJson as Record<string, { tier: 1 | 2; state: string }>;

/** Tap-friendly business types. `segment` is the base segment; 3+ sites makes it multi-site. */
export const BUSINESS_TYPES: {
  key: string;
  emoji: string;
  segment: Segment;
  needs: Need[]; // popular needs for this type (pre-highlighted)
}[] = [
  { key: "kirana", emoji: "🛒", segment: "micro", needs: ["payments", "whatsapp", "cctv"] },
  { key: "pharmacy", emoji: "💊", segment: "micro", needs: ["payments", "cctv", "whatsapp"] },
  { key: "salon", emoji: "✂️", segment: "micro", needs: ["whatsapp", "payments", "wifi"] },
  { key: "bakery", emoji: "🥐", segment: "micro", needs: ["payments", "whatsapp", "website"] },
  { key: "boutique", emoji: "👗", segment: "micro", needs: ["whatsapp", "payments", "website"] },
  { key: "restaurant", emoji: "🍽️", segment: "micro", needs: ["payments", "wifi", "cctv"] },
  { key: "clinic", emoji: "🩺", segment: "prof", needs: ["email", "backup", "whatsapp", "uptime"] },
  { key: "office", emoji: "💼", segment: "prof", needs: ["email", "backup", "security", "uptime"] },
  { key: "coaching", emoji: "🎓", segment: "prof", needs: ["wifi", "whatsapp", "email"] },
  { key: "chain", emoji: "🏬", segment: "multi", needs: ["payments", "cctv", "uptime", "email"] },
  { key: "factory", emoji: "🏭", segment: "mfg", needs: ["machines", "security", "remote", "cctv"] },
];

export const NEEDS: { key: Need; emoji: string }[] = [
  { key: "payments", emoji: "💳" },
  { key: "whatsapp", emoji: "💬" },
  { key: "cctv", emoji: "📹" },
  { key: "wifi", emoji: "📶" },
  { key: "email", emoji: "✉️" },
  { key: "backup", emoji: "🗄️" },
  { key: "security", emoji: "🛡️" },
  { key: "uptime", emoji: "⚡" },
  { key: "website", emoji: "🌐" },
  { key: "calls", emoji: "☎️" },
  { key: "tollfree", emoji: "📞" },
  { key: "sms", emoji: "📨" },
  { key: "remote", emoji: "🖥️" },
  { key: "machines", emoji: "⚙️" },
  { key: "fleet", emoji: "🚚" },
];

export const CONTRACTS = [12, 24, 36] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  Connectivity: "🌐",
  Communication: "💬",
  "Cloud & Productivity": "☁️",
  Security: "🛡️",
  "IoT & Physical": "📡",
};

export const PRODUCT_EMOJI: Record<string, string> = {
  P01: "⚡", P02: "🚀", P03: "🛰️", P04: "📡", P05: "🔗", P06: "🔗", P07: "📱", P08: "📱",
  P09: "🔁", P10: "🧭", P11: "📍", P12: "☎️", P13: "📞", P14: "📨", P15: "💬", P16: "✉️",
  P17: "🗄️", P18: "🌐", P19: "💳", P20: "🛡️", P21: "🧱", P22: "📶", P23: "📹", P24: "⚙️", P25: "🚚",
};

export function segmentFor(businessType: string | undefined, sites: number | undefined): Segment | undefined {
  const t = BUSINESS_TYPES.find((b) => b.key === businessType);
  if (!t) return sites && sites >= 3 ? "multi" : undefined;
  if (t.segment === "mfg") return "mfg";
  if ((sites ?? 1) >= 3) return "multi";
  return t.segment;
}

export function tierFor(city: string | undefined): 1 | 2 | undefined {
  if (!city) return undefined;
  return CITIES[city]?.tier ?? 2; // unknown cities treated as tier 2 (conservative)
}
