// Re-exports the port's functions only — the domain view (Product, Variant,
// OptionAxis, Money) that this module will export instead lands in PR4b,
// once the mapper exists. Wire types are never re-exported from here (see
// `./api/types.ts`'s module comment); this file is the intended single
// crossing point into the catalog module, BY CONVENTION ONLY today — a deep
// import such as `import type {...} from "@/modules/catalog/api/types"`
// still compiles right now. Task 4b.15 adds the ESLint
// `no-restricted-imports` rule that makes that actually impossible, not
// just discouraged.
export { getProducts, getProductByHandle } from "./api/source";
export type { CatalogPort } from "./api/port";
