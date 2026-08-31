// The single crossing point into the catalog module. Everything a consumer
// legitimately needs is here, and nothing wire-shaped is: `api/**`'s Zod
// schemas and `{en,es,pt}`/price-string types are never re-exported, and the
// port itself now returns the domain view (see `./api/port.ts`), so no wire
// shape can reach a consumer even through a return type.
//
// `mapToProductView` is deliberately NOT exported: the port already applies
// it, and exporting it would hand consumers a reason to hold wire data.
//
// This file is convention; the ESLint `no-restricted-imports` rule (task
// 4b.15) is what makes a deep import such as
// `import type {...} from "@/modules/catalog/api/types"` actually fail
// instead of merely being discouraged.
export { getProducts, getProductByHandle } from "./api/source";
export type { CatalogPort } from "./api/port";

export { CatalogContractError } from "./domain/product";
export type {
  ImageView,
  Money,
  OptionAxis,
  ProductView,
  VariantView,
} from "./domain/product";

export { deriveAxisStates, resolveVariant } from "./domain/selectors";
export type {
  AxisValueState,
  AxisValueView,
  Selection,
} from "./domain/selectors";

export { formatMoney } from "./lib/money";
