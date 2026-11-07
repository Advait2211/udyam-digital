import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/catalogue";
import { mergeProfile, parseFreeText } from "@/lib/engine/parse";
import { priceQuote } from "@/lib/engine/pricing";
import { contextFor, eligible, recommend } from "@/lib/engine/recommend";
import type { Profile } from "@/lib/types";

const profileFrom = (text: string): Profile => mergeProfile({ needs: [] }, parseFreeText(text).patch);

/** Every recommended line must satisfy every catalogue rule. */
function assertCatalogueSafe(p: Profile) {
  const r = recommend(p);
  const c = contextFor(p);
  for (const l of r.lines) {
    expect(eligible(l.id, c), `${l.id} eligibility`).toEqual({ ok: true });
    const deps = PRODUCTS[l.id].requiresOneOf;
    if (deps.length && l.on) expect(r.lines.some((h) => h.on && deps.includes(h.id)), `${l.id} dependency`).toBe(true);
  }
  const q = priceQuote(r.lines, 12);
  for (const l of q.lines) {
    const p = PRODUCTS[l.id];
    expect(l.unitPrice).toBeGreaterThanOrEqual(p.priceMin);
    expect(l.unitPrice).toBeLessThanOrEqual(p.priceMax);
  }
  return { r, q };
}

const SCENARIOS: [string, (r: ReturnType<typeof recommend>, p: Profile) => void][] = [
  ["I run a kirana store in Pune, 3 staff, want UPI billing and WhatsApp orders, have GST", (r, p) => {
    expect(p.businessType).toBe("kirana");
    expect(r.lines.find((l) => l.id === "P01")?.on).toBe(true);
    expect(r.lines.some((l) => l.id === "P19" && l.on)).toBe(true);
    expect(r.lines.some((l) => l.id === "P15" && l.on)).toBe(true);
  }],
  ["Dental clinic in Nagpur with 6 staff, no GST, want WhatsApp appointment reminders", (r, p) => {
    expect(p.hasGstin).toBe(false);
    expect(r.lines.some((l) => l.id === "P15")).toBe(false);
    expect(r.blocked.find((b) => b.id === "P15")?.reason).toBe("gstin");
  }],
  ["Physiotherapy clinic in Kochi, 20 staff, have GST", (r) => {
    // Fibre 1G is tier-1 only; Kochi is tier 2
    expect(r.lines.some((l) => l.id === "P03")).toBe(false);
    expect(r.lines.some((l) => l.id === "P02")).toBe(true);
  }],
  ["CA firm in Mumbai, 18 people, GST registered, need email and backup and cyber security", (r) => {
    expect(r.lines.some((l) => l.id === "P03")).toBe(true);
    expect(r.lines.some((l) => l.id === "P21" && l.on)).toBe(true);
    expect(r.lines.find((l) => l.id === "P16")?.qty).toBeGreaterThanOrEqual(10);
  }],
  ["Restaurant chain with 6 outlets in Bengaluru, 60 staff, GST yes, want billing, CCTV and never go offline", (r, p) => {
    expect(p.segment).toBe("multi");
    expect(r.lines.find((l) => l.id === "P19")?.qty).toBe(6);
    expect(r.lines.some((l) => l.id === "P10")).toBe(true);
    expect(r.lines.find((l) => l.id === "P09")?.qty).toBe(6);
  }],
  ["Small textile factory in Surat, 40 workers, GST registered, want machine monitoring", (r) => {
    expect(r.lines.some((l) => l.id === "P05")).toBe(true);
    expect(r.lines.some((l) => l.id === "P24" && l.on)).toBe(true);
  }],
  ["Auto parts unit in Ludhiana, 8 workers, no GST, machine monitoring", (r) => {
    expect(r.lines.some((l) => l.id === "P24")).toBe(false);
    expect(r.blocked.some((b) => b.id === "P24")).toBe(true);
  }],
  ["Salon in Jaipur, just me, fibre not available, want WhatsApp", (r, p) => {
    expect(p.noFibre).toBe(true);
    expect(r.lines.some((l) => l.id === "P04")).toBe(true);
    expect(r.lines.some((l) => l.id === "P01")).toBe(false);
  }],
  ["मेरी पुणे में किराना दुकान है, 4 लोग काम करते हैं, जीएसटी नहीं है, यूपीआई बिलिंग चाहिए", (r, p) => {
    expect(p.businessType).toBe("kirana");
    expect(p.city).toBe("Pune");
    expect(p.employees).toBe(4);
    expect(p.hasGstin).toBe(false);
    expect(r.lines.some((l) => l.id === "P19" && l.on)).toBe(true);
  }],
  ["माझा नाशिक मध्ये दवाखाना आहे, ५ कर्मचारी, जीएसटी आहे, बॅकअप आणि ईमेल हवे", (r, p) => {
    expect(p.businessType).toBe("clinic");
    expect(p.city).toBe("Nashik");
    expect(p.employees).toBe(5);
    expect(r.lines.some((l) => l.id === "P16" && l.on)).toBe(true);
  }],
  ["Coaching centre in Patna, 2 teachers, want calls / IVR", (r) => {
    // Cloud telephony needs 3+ employees
    expect(r.lines.some((l) => l.id === "P12")).toBe(false);
  }],
  ["Pharmacy chain, 5 branches in Hyderabad, 30 staff, GSTIN 36AAAXA1234A1Z5", (r, p) => {
    expect(p.segment).toBe("multi");
    expect(p.sites).toBe(5);
  }],
  ["Bakery in Lucknow with delivery vans 3, GST yes, want fleet tracking", (r) => {
    expect(r.lines.find((l) => l.id === "P25")?.qty).toBe(3);
  }],
  ["Law office in Delhi, 12 people, have GST, need remote access to our server", (r) => {
    expect(r.lines.some((l) => l.id === "P11" && l.on)).toBe(true);
  }],
  ["Gym chain 4 locations Chennai 25 staff, need customer wifi and toll free number, have gst", (r) => {
    expect(r.lines.find((l) => l.id === "P22")?.qty).toBe(4);
    expect(r.lines.some((l) => l.id === "P13" && l.on)).toBe(true);
  }],
];

describe("Advisor — judge-style scenarios", () => {
  for (const [text, expectations] of SCENARIOS) {
    it(text, () => {
      const p = profileFrom(text);
      const { r } = assertCatalogueSafe(p);
      expectations(r, p);
    });
  }

  it("cancelled GSTIN removes GST-only products", () => {
    const p: Profile = { businessType: "kirana", employees: 3, sites: 1, city: "Pune", tier: 1, needs: ["whatsapp", "sms"], hasGstin: true, gstStatus: "Cancelled" };
    const { r } = assertCatalogueSafe(p);
    expect(r.lines.some((l) => l.id === "P15" || l.id === "P14")).toBe(false);
    expect(r.blocked.find((b) => b.id === "P15")?.reason).toBe("gstinStatus");
  });

  it("micro bundle stays near the micro budget (₹2.5k)", () => {
    const p = profileFrom("kirana store in Indore, 3 staff, upi billing");
    const q = priceQuote(recommend(p).lines, 12);
    expect(q.monthly).toBeLessThan(3200);
  });

  it("is safe across a sweep of random profiles", () => {
    const types = ["kirana", "pharmacy", "salon", "bakery", "boutique", "restaurant", "clinic", "office", "coaching", "chain", "factory"];
    const needs = ["payments", "whatsapp", "email", "backup", "cctv", "calls", "tollfree", "website", "security", "wifi", "machines", "fleet", "uptime", "sms", "remote"] as const;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) {
      const p: Profile = {
        businessType: types[Math.floor(rnd() * types.length)],
        employees: Math.ceil(rnd() * 150),
        sites: Math.ceil(rnd() * 12),
        tier: rnd() > 0.5 ? 1 : 2,
        hasGstin: rnd() > 0.3,
        gstStatus: rnd() > 0.9 ? "Suspended" : undefined,
        noFibre: rnd() > 0.85,
        needs: needs.filter(() => rnd() > 0.7),
      };
      assertCatalogueSafe(mergeProfile({ needs: [] }, p));
    }
  });
});
