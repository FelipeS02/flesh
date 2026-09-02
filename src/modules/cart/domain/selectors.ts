// Imports from `catalog/client`, never the module's server entry
// (`@/modules/catalog`): that barrel re-exports `getPricingPolicy`, which
// carries `import "server-only"`. This file is reachable from
// `CartProvider` ('use client', PR2b), so pulling in the server barrel
// here would fail the client build the day a consumer exists — the exact
// class of error `pnpm build` exists to catch (see `sdd/flesh-cart/design`
// D1/D2). `applyRate`/`transferBreakdown` have no `server-only` dependency
// and are re-exported from `client.ts` for exactly this reason.
import { transferBreakdown, type Money } from "@/modules/catalog/client";
import type { CartLine, CartTotals } from "./line";

/**
 * Total units across every line — NOT the number of lines. This is the
 * header badge's count (task 4.5), so "2 lines, quantity 3 each" must read
 * as 6, not 2.
 */
export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Sums `price * quantity` across every line. Money arithmetic stays
 * integer throughout: `line.price.amount` is already an integer minor-unit
 * count, and `quantity` is a plain integer multiplier — no divide, so no
 * rounding site is needed here (unlike `transferBreakdown`, see below).
 *
 * Currency is read from the first line, defaulting to ARS for an empty
 * cart — this repo is single-currency (see `money.ts`), so a mixed-currency
 * cart is not a case the domain needs to reject; nothing today produces one.
 */
export function subtotal(lines: CartLine[]): Money {
  const currency = lines[0]?.price.currency ?? "ARS";

  return lines.reduce(
    (sum, line) => ({ amount: sum.amount + line.price.amount * line.quantity, currency }),
    { amount: 0, currency },
  );
}

/**
 * The summary's full breakdown. Delegates to `catalog`'s `transferBreakdown`
 * — the ONE shared discount policy for PDP and cart (spec requirement) —
 * applying the rate ONCE to the combined subtotal, never per line. Doing it
 * per line and summing would reintroduce exactly the rounding drift the
 * artboard case and the half-cent test below are used to prove does not
 * happen (see `catalog/lib/pricing.ts`).
 */
export function totals(lines: CartLine[], transferRateBp: number): CartTotals {
  const lineSubtotal = subtotal(lines);
  const { discount, total } = transferBreakdown(lineSubtotal, transferRateBp);

  return { subtotal: lineSubtotal, discount, total };
}
