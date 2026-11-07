import type { Lang } from "../types";
import { en, type TKey } from "./en";
import { hi } from "./hi";
import { mr } from "./mr";

const DICTS: Record<Lang, Record<string, string>> = { en, hi: hi as Record<string, string>, mr: mr as Record<string, string> };

export type Params = Record<string, string | number | undefined>;

/** Looks up `key` in the chosen language, falling back to English, then to a shorter key ("why.P02.mfg" → "why.P02"). */
export function translate(lang: Lang, key: TKey | string, params?: Params): string {
  let k = key as string;
  let s: string | undefined;
  for (;;) {
    s = DICTS[lang][k] ?? (en as Record<string, string>)[k];
    if (s !== undefined) break;
    const i = k.lastIndexOf(".");
    if (i <= 0) break;
    k = k.slice(0, i);
  }
  if (s === undefined) return key as string;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, p) => (params[p] !== undefined ? String(params[p]) : `{${p}}`));
}

export type T = (key: TKey | string, params?: Params) => string;
export const LANGS: Lang[] = ["en", "hi", "mr"];
export const SPEECH_LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
