import { Toast } from "@base-ui/react/toast";
import type { CartLineId } from "../../domain/line";

/**
 * The one, fixed identity for the "added to cart" toast. Every add site
 * shares this id so a second add DEDUPES onto the same toast instead of
 * stacking a new one — see `showAddedToCart` below.
 */
export const ADDED_TO_CART_TOAST_ID = "cart-added";

/**
 * The toast payload. Deliberately just enough to look the display data up
 * live (design D6): `VariantView` carries no title or image, and
 * `PurchasePanel` cannot hand either to the toast, so `AddedToast`
 * (`added-toast.tsx`) resolves them through `indexCartCatalog` instead.
 * `repeat` is computed at the add site because that is the only place the
 * "was this variant already in the cart before this dispatch" fact exists
 * unambiguously.
 */
export type AddedToCartData = {
  variantId: CartLineId;
  repeat: boolean;
};

/**
 * Module-scope, not a React context: `PurchasePanel` needs to fire this from
 * an event handler with no dependency on whether a `CartToastViewport`
 * happens to be mounted anywhere in the tree (see D3 — the viewport
 * unmounts entirely while the drawer is open, and `add()` on an unmounted
 * provider simply emits into an empty listener set, per
 * `createToastManager.js:11-15`). Using `useToastManager()`'s return value
 * here instead would require threading a context handle down to the PDP,
 * for a a feature that is really "fire and forget."
 */
export const cartToastManager = Toast.createToastManager<AddedToCartData>();

/**
 * Deliberately NOT a `CartNotice`.
 *
 * A `CartNotice` (`domain/line.ts`) is a durable rehydration fact: a record
 * of what the shopper was TOLD about a stock or price change that happened
 * while they were away, persisted so it survives a reload and is dismissed
 * exactly once. This toast is the opposite in every way that matters — it is
 * ephemeral, created by the shopper's OWN action in the current session, and
 * must never reach `localStorage` (see `toStoredCart` in `state/cart-context.tsx`,
 * which does not and must not know this toast exists). The two only LOOK
 * similar because both eventually render a sentence about a cart line; do
 * not fold this into `CartNotice` to "avoid duplication" — that would smuggle
 * a purchase-session-only fact into the persisted cart record.
 *
 * `add()`, never `update()`. Both `add()` (with an existing id) and `update()`
 * can upsert the same toast, but only `add()` resets its auto-dismiss timer:
 * the public `update()` defaults `resetTimer` to `false` and only reschedules
 * when the timeout VALUE itself changed (`store.js:157-168, :205`). Since this
 * toast's timeout is always the provider's default, a real re-add through
 * `update()` would leave the FIRST timer running — silently breaking the
 * decided "timer restarts on re-add" behaviour the moment a second unit is
 * added just before the first would have dismissed.
 */
export function showAddedToCart(data: AddedToCartData): void {
  cartToastManager.add({
    id: ADDED_TO_CART_TOAST_ID,
    priority: "low",
    data,
  });
}
