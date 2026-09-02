import type { Money } from "@/modules/catalog/client";
import type { CartLineId } from "../api/port";

export type { CartLineId };

/**
 * A live line in the cart. Deliberately carries NO display data (title,
 * combination, image) — the design's own rule for `line-row.tsx`: those
 * always come from the live `CartCatalog`, never from a stored or reducer
 * copy, so a renamed product or a stale combination can never leak onto
 * screen (see `sdd/flesh-cart/design` D3/D1).
 *
 * `price` IS carried here, unlike display data, because it is what the
 * pure `selectors.ts` needs to compute a subtotal without reaching back
 * into the catalog — the whole point of keeping the reducer/selectors
 * layer catalog-free and unit-testable with zero IO. It is kept in sync
 * with the catalog by `reconcile` (see `reconcile.ts`), which is the one
 * place a line's price is ever allowed to change.
 */
export type CartLine = {
  productId: number;
  variantId: CartLineId;
  quantity: number;
  price: Money;
};

/**
 * What `CheckoutPort.startCheckout` receives. A thin wrapper over `lines`
 * today — kept as its own type rather than passing `CartLine[]` directly
 * so a future field (e.g. a customer note) has somewhere to go without
 * changing every `CheckoutPort` implementation's signature.
 */
export type CartView = {
  lines: CartLine[];
};

/**
 * A record of a rehydration-time drift event, per design decision D4.
 *
 * `item` is non-null EXACTLY when the catalog can still rebuild the line's
 * label — out-of-stock and repriced lines are still present in the catalog
 * index, so their name is recoverable; a vanished variant is not, and no
 * display data was ever persisted for it to fall back on (D3). The type
 * makes that asymmetry a compile-time fact instead of a runtime
 * `?? "un producto"` a caller could forget.
 *
 * Identity is `variantId`, not a synthetic notice id: a variant's line is
 * either removed or repriced, never both, so no line ever needs two
 * notices at once.
 */
export type CartNotice =
  | { kind: "removed"; reason: "out-of-stock"; variantId: CartLineId; item: string }
  | { kind: "removed"; reason: "unknown-variant"; variantId: CartLineId; item: string | null }
  | { kind: "repriced"; variantId: CartLineId; item: string; from: Money; to: Money };

/**
 * The subtotal/discount/total breakdown the summary renders. `itemCount` is
 * NOT a field here — it is its own selector (`itemCount(lines)`), because a
 * caller wanting only the badge count (the header trigger) has no reason to
 * also compute a discount breakdown it will never render.
 */
export type CartTotals = {
  subtotal: Money;
  discount: Money;
  total: Money;
};
