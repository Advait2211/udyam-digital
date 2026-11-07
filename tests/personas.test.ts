import { describe, expect, it } from "vitest";
import { PERSONAS } from "@/components/personas";
import { parseFreeText } from "@/lib/engine/parse";

describe("personas parse identically in every language", () => {
  for (const [key, p] of Object.entries(PERSONAS)) {
    const en = parseFreeText(p.text.en).patch;
    for (const lang of ["hi", "mr"] as const) {
      it(`${key} · ${lang}`, () => {
        const x = parseFreeText(p.text[lang]).patch;
        expect(x.businessType).toBe(en.businessType);
        expect(x.city).toBe(en.city);
        expect(x.employees).toBe(en.employees);
        expect(x.hasGstin).toBe(en.hasGstin);
        expect(new Set(x.needs)).toEqual(new Set(en.needs));
      });
    }
  }
});
