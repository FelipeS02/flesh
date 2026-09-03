import { indexCartCatalog, type CartCatalog } from "../domain/catalog-projection";
import type { CartView } from "../domain/line";
import type { CartLineId, CheckoutOutcome, CheckoutPort } from "./port";

/**
 * The message the CTA renders when the port answers `unavailable`, which today
 * is every real checkout attempt. Body copy, so accents are correct here — the
 * ASCII-only rule applies to `$font-display` strings, not to this (see the
 * design's resolved open question about Copperplate's measured charset).
 *
 * It is a named export rather than an inline literal so a test can assert the
 * exact outcome the UI will show, instead of asserting that some string came
 * back and hoping it says something true.
 */
export const CHECKOUT_UNAVAILABLE_REASON =
  "Todavía no podemos procesar la compra en línea. Escribinos y la cerramos por mensaje.";

/**
 * A FACTORY over the catalog projection, never a module singleton.
 *
 * The reason is structural, not stylistic: this file is reachable from
 * `'use client'` code, and the catalog cannot be imported there at all —
 * `@/modules/catalog` re-exports `server-only` values (design D1). The only
 * catalog a client-side checkout can see is the one the server already
 * projected and handed down as a prop, so it arrives through a closure. That
 * closure is simultaneously the seam the tests stand on.
 */
export function createLocalCheckout(catalog: CartCatalog): CheckoutPort {
  const index = indexCartCatalog(catalog);

  return {
    /**
     * Availability first, then the honest answer — the same order a live
     * checkout must follow, because a real one rejects on stock before it
     * creates a payment session. Keeping that order here means the day this
     * port is swapped for a network call, the branch structure it replaces is
     * already the right one.
     *
     * `async` with no `await`: `CheckoutPort` returns a Promise because the
     * live implementation will, and typing this one as synchronous would push
     * every caller to handle two shapes. The absence of latency is real and is
     * NOT padded with a timer to make the pending frame visible — faking
     * latency to demo a spinner is the dishonesty this whole seam exists to
     * avoid (design D6).
     */
    async startCheckout(cart: CartView): Promise<CheckoutOutcome> {
      const unavailable = findUnavailable(cart, index);

      if (unavailable.length > 0) {
        return { status: "rejected", lines: unavailable };
      }

      // Not a placeholder for a success branch: there is no server to redirect
      // to, and pretending otherwise would be the one lie this port must never
      // tell (spec: "MUST NOT hardcode a success branch").
      return { status: "unavailable", reason: CHECKOUT_UNAVAILABLE_REASON };
    },
  };
}

/**
 * A line is unavailable when the catalog cannot sell it — either it is gone
 * from the projection entirely, or it is present and out of stock. Both are
 * the same fact from the shopper's side, so both land in one list.
 *
 * Through the product this list is always empty: rehydration already removed
 * every unavailable line before checkout could see one (design D5). The guard
 * is kept because it is what a live implementation must do, and because a
 * branch with no producer is a branch nobody can trust.
 */
function findUnavailable(
  cart: CartView,
  index: ReturnType<typeof indexCartCatalog>,
): CartLineId[] {
  return cart.lines
    .filter((line) => !index.get(line.variantId)?.variant.inStock)
    .map((line) => line.variantId);
}
