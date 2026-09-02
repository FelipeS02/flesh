// The SERVER crossing point into the catalog module. Everything a consumer
// legitimately needs is here, and nothing wire-shaped is: `api/**`'s Zod
// schemas and `{en,es,pt}`/price-string types are never re-exported, and the
// port itself now returns the domain view (see `./api/port.ts`), so no wire
// shape can reach a consumer even through a return type.
//
// `mapToProductView` is deliberately NOT exported: the port already applies
// it, and exporting it would hand consumers a reason to hold wire data.
//
// A `'use client'` component must import from `./client.ts` instead. This file
// re-exports `api/source`, which is marked `server-only` — reaching it from
// the browser bundle is a build error, and `./client.ts` exists so that the
// pure domain half is still importable from there.
//
// This file is convention; the ESLint `no-restricted-imports` rule (task
// 4b.15) is what makes a deep import such as
// `import type {...} from "@/modules/catalog/api/types"` actually fail
// instead of merely being discouraged.
export { getProducts, getProductByHandle } from "./api/source";
export type { CatalogPort } from "./api/port";

// The pricing policy port follows the same server-only pattern as the
// catalog port above: today's rate is a local stand-in, tomorrow's is a
// Tiendanube store-settings fetch, and no cart or PDP call site is touched
// either way (see `api/pricing.ts` and design decision D2).
export { getPricingPolicy } from "./api/pricing";
export type { PricingPolicy } from "./api/pricing";

// `applyRate`/`transferBreakdown` are pure and carry no server-only
// dependency — a client component could import them safely. They are NOT
// re-exported from `./client` here: task 1a.5 scopes this change to
// `index.ts` only, and the cart's summary consumer does not exist yet in
// this slice. If a future client-side consumer needs them before `client.ts`
// is revisited, that is a scope call for that slice, not this one.
export { applyRate, transferBreakdown } from "./lib/pricing";

export * from "./client";
