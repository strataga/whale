import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "convex/_generated/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // This repo intentionally uses `any` in several integration seams (Convex, bots, payments).
      // Keep linting useful by not failing the entire gate on explicit-any.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
