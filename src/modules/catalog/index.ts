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
export {
  getProducts,
  getProductByHandle,
  getColourwayIndex,
} from "./api/source";
export type { CatalogPort } from "./api/port";

export * from "./client";
