import type { Money } from "./money";

/**
 * The transfer-discount rate, expressed in basis points (1000 bp === 10%),
 * never a float. `TRANSFER_DISCOUNT_RATE = 0.1` (see
 * `modules/storefront/pricing.ts`) is exactly the mistake `money.ts` is
 * hand-rolled to avoid: `amount * 0.1` on an integer minor-unit count risks
 * the same float drift `parseMoney` exists to sidestep. Basis points keep
 * every step of the arithmetic an integer until the single, deliberate
 * `Math.round`.
 *
 * Both functions are pure and take the rate as a parameter — the value
 * itself is never a module constant here (see `catalog/api/pricing.ts`'s
 * `PricingPolicyPort`), so a call site can never hardcode it.
 */

/**
 * The price after the rate is taken off a single Money value — the figure
 * shown next to "CON TRANSFERENCIA" for one item. Callers must pass the
 * variant's current EFFECTIVE price (`variant.price`, already promotional if
 * a promo is active), never `compareAt`: this function only ever sees one
 * number and has no way to reach for a second, so which price is "effective"
 * is a decision the caller makes, not this function.
 */
export function applyRate(money: Money, rateBp: number): Money {
  const discountAmount = Math.round((money.amount * rateBp) / 10_000);

  return { amount: money.amount - discountAmount, currency: money.currency };
}

/**
 * Discount and total for a whole cart subtotal. Applied ONCE to the
 * subtotal, never per line — computing it per line and summing would
 * introduce exactly the kind of rounding drift the artboard case (3 x
 * $27.000) is used to prove does not happen.
 */
export function transferBreakdown(
  subtotal: Money,
  rateBp: number,
): { discount: Money; total: Money } {
  const discountAmount = Math.round((subtotal.amount * rateBp) / 10_000);

  return {
    discount: { amount: discountAmount, currency: subtotal.currency },
    total: {
      amount: subtotal.amount - discountAmount,
      currency: subtotal.currency,
    },
  };
}
