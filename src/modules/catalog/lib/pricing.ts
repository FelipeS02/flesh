import type { Money } from "./money";

/**
 * The transfer-discount rate, expressed in basis points (1000 bp === 10%),
 * never a float. A float rate is exactly the mistake `money.ts` is hand-rolled
 * to avoid: `amount * 0.1` on an integer minor-unit count risks the same drift
 * `parseMoney` exists to sidestep. Basis points keep every step of the
 * arithmetic an integer until the single, deliberate `Math.round`.
 *
 * Both functions are pure and take the rate as a PARAMETER, so no call site
 * can hardcode it. `getPricingPolicy()` in `catalog/api/pricing.ts` is where
 * the value comes from on the server, and is the seam a live Tiendanube
 * store-settings read replaces.
 */

/**
 * The rate itself — the ONE place 10% is written down in this repo.
 *
 * It lives in the pure layer, not next to the port, for a reason that is
 * mechanical rather than aesthetic: the storefront's own price display runs
 * inside the client bundle, and `api/pricing.ts` carries `import "server-only"`.
 * A client component reaching for the rate through the port is a build error,
 * so the constant has to be reachable from `catalog/client.ts`.
 *
 * This is a stand-in, not the destination. The rate is a Tiendanube store
 * setting, and once `CartProvider` carries it down from the server (task 2b.7)
 * the display components should take it as data and this export should go.
 */
export const TRANSFER_RATE_BP = 1000;

/**
 * The price after the rate is taken off a single Money value — the figure
 * shown next to "CON TRANSFERENCIA" for one item. Callers must pass the
 * variant's current EFFECTIVE price (`variant.price`, already promotional if
 * a promo is active), never `compareAt`: this function only ever sees one
 * number and has no way to reach for a second, so which price is "effective"
 * is a decision the caller makes, not this function.
 */
export function applyRate(money: Money, rateBp: number): Money {
  return { amount: money.amount - discountAmount(money, rateBp), currency: money.currency };
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
  const amount = discountAmount(subtotal, rateBp);

  return {
    discount: { amount, currency: subtotal.currency },
    total: {
      amount: subtotal.amount - amount,
      currency: subtotal.currency,
    },
  };
}

/**
 * The ONE rounding site in this module, and the reason both exported functions
 * delegate to it rather than each writing the expression out.
 *
 * The two of them differ only in what they return — a net price, or the
 * discount and the total as a pair — never in how the discount is computed.
 * Written twice, that shared meaning is a coincidence a future edit can break
 * silently; this file exists precisely because two copies of one policy drifted
 * apart once already.
 *
 * Integer multiply first, one deliberate `Math.round` on the divide. The
 * intermediate `amount * rateBp` stays an integer, so nothing rounds twice.
 */
function discountAmount({ amount }: Money, rateBp: number): number {
  return Math.round((amount * rateBp) / 10_000);
}
