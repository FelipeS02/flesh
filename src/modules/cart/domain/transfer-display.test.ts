import { describe, expect, it } from "vitest";
import { applyRate, TRANSFER_RATE_BP } from "@/modules/catalog/client";
import type { CartLine } from "./line";
import { totals } from "./selectors";

const ars = (amount: number) => ({ amount, currency: "ARS" }) as const;

function line(price: ReturnType<typeof ars>, quantity: number): CartLine {
  return { productId: 1, variantId: 1, quantity, price };
}

/**
 * Design D1: `catalog/lib/pricing.ts` and `cart/domain/selectors.ts` are NOT
 * touched by this change. `totals()` rounds ONCE, on the combined subtotal.
 * These tests exist to PROVE the precondition that makes that single-site
 * rounding agree with a naive per-line rounding for every price this store
 * can actually sell — rather than asserting the agreement as a given.
 */
describe("transfer display: single-site rounding vs. summing per-line transfer prices", () => {
  it("T1: 3 x $27.000 agree exactly", () => {
    const lines = [line(ars(2_700_000), 3)];
    const perLineSum = lines.reduce(
      (sum, current) => sum + applyRate(current.price, TRANSFER_RATE_BP).amount * current.quantity,
      0,
    );

    expect(perLineSum).toBe(totals(lines, TRANSFER_RATE_BP).total.amount);
  });

  it("T2: a mixed cart of real ARS price points ($92.000 + 2 x $27.000) agrees exactly", () => {
    const lines = [line(ars(9_200_000), 1), line(ars(2_700_000), 2)];
    const perLineSum = lines.reduce(
      (sum, current) => sum + applyRate(current.price, TRANSFER_RATE_BP).amount * current.quantity,
      0,
    );

    expect(perLineSum).toBe(totals(lines, TRANSFER_RATE_BP).total.amount);
  });

  it("T3: an engineered drift (3 x $19,95) is off by exactly 1 minor unit — pinned, not merely observed", () => {
    const lines = [line(ars(1_995), 3)];
    const perLineSum = lines.reduce(
      (sum, current) => sum + applyRate(current.price, TRANSFER_RATE_BP).amount * current.quantity,
      0,
    );

    expect(perLineSum).toBe(5_385);
    expect(totals(lines, TRANSFER_RATE_BP).total.amount).toBe(5_386);
  });

  // T4 (the precondition guard over every REAL catalogue price) is NOT here.
  // It lives in `src/modules/catalog/api/fixtures/products.test.ts` instead:
  // the task list originally specified reaching `mapToProductView` and the
  // wire fixtures directly from this file, but both are blocked from outside
  // `modules/catalog` by the `no-restricted-imports` ESLint rule, and the
  // module's own public entry (`getProducts()`) cannot run un-mocked inside a
  // unit test — it wraps `next/cache`'s `unstable_cache`, which throws
  // ("Invariant: incrementalCache missing") outside a real Next.js request.
  // The precondition is catalog's own data contract with every consumer that
  // depends on it (this file's T1-T3 chief among them), so it is guarded from
  // inside the module that owns the data, not from across the boundary.
});
