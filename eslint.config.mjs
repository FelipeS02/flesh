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
    "next-env.d.ts",
  ]),
  // The catalog module's wire layer (`api/**`) is private. `index.ts` not
  // re-exporting it is encapsulation by CONVENTION only — a deep import
  // still compiles. This rule is what makes it fail. The module itself is
  // exempt: `source.ts` and the mapper legitimately read their own wire
  // types.
  //
  // Covers both the `@/`-aliased form and relative paths, because only the
  // literal import string is matched — `@/modules/catalog/api/types` and
  // `../../catalog/api/types` are the same violation written two ways.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/modules/catalog/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/modules/catalog/api",
                "**/modules/catalog/api/**",
                "**/catalog/api",
                "**/catalog/api/**",
              ],
              message:
                "The catalog module's wire layer is private. Import from '@/modules/catalog' instead — it exports the domain view (ProductView, Money, selectors), never Tiendanube's wire shape.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
