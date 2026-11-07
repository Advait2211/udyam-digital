"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { translate, type Params, type T } from "./i18n";
import type { TKey } from "./i18n/en";
import { mergeProfile } from "./engine/parse";
import { recommend } from "./engine/recommend";
import type { BundleLine, Lang, Profile } from "./types";

export interface ConsentRecord {
  id: string;
  required: boolean;
  digilocker: boolean;
  marketing: boolean;
  at: string;
}

interface JourneyState {
  lang: Lang;
  profile: Profile;
  lines: BundleLine[] | null; // the owner's customised quote (null = follow the recommendation)
  contract: number;
  consent: ConsentRecord | null;
  kycVerdict: "verified" | "action" | "blocked" | null;
  kycBusiness: { gstin?: string; legalName?: string; tradeName?: string; signatory?: string } | null;
  nonGstOnly: boolean;
  orderIds: string[];
  hydrated: boolean;
  setLang: (l: Lang) => void;
  patchProfile: (p: Partial<Profile>) => void;
  setProfile: (p: Profile) => void;
  reset: () => void;
  setLines: (l: BundleLine[] | null) => void;
  setContract: (c: number) => void;
  setConsent: (c: ConsentRecord | null) => void;
  setKyc: (v: JourneyState["kycVerdict"], b: JourneyState["kycBusiness"]) => void;
  setNonGstOnly: (v: boolean) => void;
  addOrder: (id: string) => void;
}

const EMPTY: Profile = { needs: [] };

export const useJourney = create<JourneyState>()(
  persist(
    (set) => ({
      lang: "en",
      profile: EMPTY,
      lines: null,
      contract: 12,
      consent: null,
      kycVerdict: null,
      kycBusiness: null,
      nonGstOnly: false,
      orderIds: [],
      hydrated: false,
      setLang: (lang) => set({ lang }),
      patchProfile: (p) => set((s) => ({ profile: mergeProfile(s.profile, p), lines: null })),
      setProfile: (profile) => set({ profile, lines: null }),
      reset: () => set({ profile: EMPTY, lines: null, contract: 12, consent: null, kycVerdict: null, kycBusiness: null, nonGstOnly: false }),
      setLines: (lines) => set({ lines }),
      setContract: (contract) => set({ contract }),
      setConsent: (consent) => set({ consent }),
      setKyc: (kycVerdict, kycBusiness) => set({ kycVerdict, kycBusiness }),
      setNonGstOnly: (nonGstOnly) => set({ nonGstOnly }),
      addOrder: (id) => set((s) => ({ orderIds: [id, ...s.orderIds.filter((x) => x !== id)].slice(0, 10) })),
    }),
    {
      name: "accel-journey",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
      }),
      // Privacy: no document data is persisted in the browser — only journey choices
      partialize: (s) => ({ lang: s.lang, profile: s.profile, lines: s.lines, contract: s.contract, consent: s.consent, kycVerdict: s.kycVerdict, nonGstOnly: s.nonGstOnly, orderIds: s.orderIds }),
      onRehydrateStorage: () => () => useJourney.setState({ hydrated: true }),
    },
  ),
);

export function useT(): T {
  const lang = useJourney((s) => s.lang);
  return useCallback((key: TKey | string, params?: Params) => translate(lang, key, params), [lang]);
}

/** The quote lines: the owner's customised list, or the live recommendation. */
export function currentLines(profile: Profile, lines: BundleLine[] | null, nonGstOnly: boolean): BundleLine[] {
  const base = lines ?? recommend(nonGstOnly ? { ...profile, hasGstin: false } : profile).lines;
  return base;
}
