import { PRODUCTS } from "../catalogue";
import type { BundleLine, PricedLine, Product, Quote } from "../types";

export const GST_RATE = 0.18;

/**
 * Price inside the catalogue range by commitment: 12 months = midpoint,
 * 24 months = 25% above the floor, 36 months = floor price. Shorter = ceiling.
 * (The leads data prices bundles around the midpoint of each range.)
 */
export function priceAt(p: Product, contract: number) {
  const c = Math.max(contract, p.minContract);
  const t = c >= 36 ? 0 : c >= 24 ? 0.25 : c >= 12 ? 0.5 : 1;
  return Math.round(p.priceMin + (p.priceMax - p.priceMin) * t);
}

/** Smallest bundle contract allowed by the products switched on. */
export function minContractFor(lines: BundleLine[]) {
  return lines.filter((l) => l.on).reduce((m, l) => Math.max(m, PRODUCTS[l.id].minContract), 12);
}

export function priceQuote(lines: BundleLine[], contract: number): Quote {
  const priced: PricedLine[] = lines.map((l) => {
    const p = PRODUCTS[l.id];
    const unitPrice = priceAt(p, contract);
    return { ...l, unitPrice, monthly: unitPrice * l.qty, setupTotal: p.setup * l.qty };
  });
  const on = priced.filter((l) => l.on);
  const monthly = on.reduce((s, l) => s + l.monthly, 0);
  const setup = on.reduce((s, l) => s + l.setupTotal, 0);
  const gst = Math.round(monthly * GST_RATE);
  return {
    lines: priced,
    contract,
    monthly,
    setup,
    gst,
    monthlyWithGst: monthly + gst,
    maxInstallDays: on.reduce((m, l) => Math.max(m, PRODUCTS[l.id].installDays), 0),
  };
}

/** Toggle a line, keeping dependencies valid (turning off a host turns off dependants). */
export function toggleLine(lines: BundleLine[], id: string, on: boolean): BundleLine[] {
  let next = lines.map((l) => (l.id === id ? { ...l, on } : l));
  if (on) {
    // switching on something that needs connectivity: ensure a host is on
    const deps = PRODUCTS[id].requiresOneOf;
    if (deps.length && !next.some((l) => l.on && deps.includes(l.id))) {
      const host = next.find((l) => deps.includes(l.id));
      if (host) next = next.map((l) => (l.id === host.id ? { ...l, on: true } : l));
    }
  } else {
    // switching off a host: dependants without another host go off too
    next = next.map((l) => {
      const deps = PRODUCTS[l.id].requiresOneOf;
      if (!l.on || !deps.length) return l;
      return next.some((h) => h.on && deps.includes(h.id)) ? l : { ...l, on: false };
    });
  }
  return next;
}

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
