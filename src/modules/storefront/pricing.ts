import type { Money } from "@/modules/catalog";

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
