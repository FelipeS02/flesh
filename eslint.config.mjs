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
  // `src/components/ui/**` is vendored: shadcn COPIES these files in, and
  // `shadcn add --overwrite` will hand them back verbatim. Patching the
  // carousel's `setState`-in-effect to satisfy the React Compiler rule would
  // therefore be undone silently by the next component we pull.
  //
  // Only that one rule is lifted, and only here. The folder still ships to
  // the browser, so everything else — unused code, the catalog import ban,
  // the accessibility rules — keeps applying to it.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
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
  // `cart/api/**` is private for the same reason as catalog/api: consumers
  // cross the module boundary through `cart/index.ts`, not a checkout or
  // storage implementation. This is deliberately a separate object so each
  // module exempts only itself from the other module's restriction.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/modules/cart/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/modules/cart/api",
                "**/modules/cart/api/**",
                "**/cart/api",
                "**/cart/api/**",
              ],
              message:
                "The cart module's API layer is private. Import from '@/modules/cart' instead â€” it exposes the provider hooks, drawer, selectors, and CheckoutPort without implementation details.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
