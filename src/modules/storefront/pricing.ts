// The client entry — see the note in `./swatches.ts`; `transferPrice` is on
// the PDP's client side too.
import { applyRate, TRANSFER_RATE_BP, type Money } from "@/modules/catalog/client";

/**
 * The price shown next to "CON TRANSFERENCIA".
 *
 * Delegates rather than computing. It used to own `TRANSFER_DISCOUNT_RATE = 0.1`
 * and multiply by it, which read as harmless until the cart's basis-point
 * policy landed beside it: `Math.round(amount * 0.9)` and
 * `amount - Math.round(amount * 0.1)` disagree by one minor unit on every
 * amount whose tenth falls on a half cent — 10% of all amounts, starting at
 * $19,95. Two implementations of one brand policy is one too many, and the
 * one that keeps its arithmetic in integers is the one that survived.
 *
 * This function stays as the storefront's own name for the idea, so the two
 * call sites keep reading as prices rather than as arithmetic. It is the rate
 * argument that is temporary: once `CartProvider` carries the real store
 * setting down from the server (task 2b.7), the display components should take
 * it as data and call `applyRate` directly.
 */
export function transferPrice(price: Money): Money {
  return applyRate(price, TRANSFER_RATE_BP);
}

/**
 * The PROMOTIONAL discount — how far the price has been marked down from the
 * original — as a whole percentage, or `null` when there is no markdown to
 * announce.
 *
 * Deliberately not the transfer discount, which the site shows as a labelled
 * price and never as a percentage badge. The two are different kinds of thing:
 * a markdown already happened and applies to everyone, while the transfer rate
 * is a condition you can still choose to meet. Giving both the same red badge
 * would make the badge mean whichever one the reader guessed.
 *
 * Returns `null` rather than a number for every input that cannot describe a
 * markdown — no original, an original that is not higher, or two currencies
 * that have no exchange rate here. A badge is a claim about a price; there is
 * no honest 0%, and no honest cross-currency percentage.
 */
export function discountPercent(price: Money, compareAt: Money | null): number | null {
  if (!compareAt || compareAt.currency !== price.currency) {
    return null;
  }

  if (compareAt.amount <= price.amount) {
    return null;
  }

  return Math.round((1 - price.amount / compareAt.amount) * 100);
}
