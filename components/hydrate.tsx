"use client";

import { useEffect } from "react";
import { useJourney } from "@/lib/store";

/** Loads saved journey choices after hydration (avoids server/client mismatches) and keeps <html lang> in sync. */
export function Hydrate() {
  const lang = useJourney((s) => s.lang);
  useEffect(() => {
    useJourney.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
