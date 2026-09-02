// The client entry — see the note in `./swatches.ts`; `transferPrice` is on
// the PDP's client side too.
import type { Money } from "@/modules/catalog/client";

/**
 * FLESH takes 10% off for bank-transfer payment. This is a fixed brand
 * policy today, which is why it is a constant here and not a per-product
 * field — but it lives as a store setting on Tiendanube, so the eventual
 * live integration reads it from there. This constant is that seam: one
 * place to change, and the only place the rate is written down.
 */
export const TRANSFER_DISCOUNT_RATE = 0.1;

/**
 * The price shown next to "CON TRANSFERENCIA".
 *
 * Rounds to a whole minor unit: `Money.amount` is an integer count of cents
 * by contract (see `catalog/lib/money.ts`), and a fractional cent would
 * silently break the formatter's grouping as well as any arithmetic done
 * downstream.
 */
export function transferPrice({ amount, currency }: Money): Money {
  return {
    amount: Math.round(amount * (1 - TRANSFER_DISCOUNT_RATE)),
    currency,
  };
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
