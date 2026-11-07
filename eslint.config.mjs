import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Mount-time reads of URL/browser capabilities intentionally set state in effects
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/tesseract/**",
    "lib/generated/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
