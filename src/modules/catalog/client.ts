// The catalog module has TWO crossing points, and the difference is which
// side of the RSC boundary the consumer lives on.
//
// This one is client-safe: pure domain types and pure functions over data
// somebody else already fetched. It reaches nothing that reads the catalogue,
// which is the whole point — `api/source.ts` carries `import "server-only"`,
// so a `'use client'` component importing the other entry (`./index.ts`) pulls
// that marker into the browser bundle and fails the build.
//
// Rule of thumb: if it needs a product, it imports from `./index.ts` and runs
// on the server. If it only needs to reason ABOUT a product it was handed, it
// imports from here.
export { CatalogContractError } from "./domain/product";
export type {
  ImageView,
  Money,
  OptionAxis,
  ProductView,
  SafeHtml,
  VariantView,
} from "./domain/product";

export { deriveAxisStates, resolveVariant } from "./domain/selectors";
export type {
  AxisValueState,
  AxisValueView,
  Selection,
  VariantMatrix,
} from "./domain/selectors";

export { formatMoney } from "./lib/money";
