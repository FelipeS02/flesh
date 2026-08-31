// Re-exports the port's functions only — the domain view (Product, Variant,
// OptionAxis, Money) that this module will export instead lands in PR4b,
// once the mapper exists. Wire types are never re-exported from here (see
// `./api/types.ts`'s module comment); this file exists precisely so nothing
// downstream needs — or is able — to import from `./api/**` directly.
export { getProducts, getProductByHandle } from "./api/source";
export type { CatalogPort } from "./api/port";
