import { describe, expect, it } from "vitest";
import { mapToProductView } from "../../../domain/map";
import { products } from "../products";

/**
 * The precondition `cart/domain/transfer-display.test.ts` (T1-T3) depends
 * on: the cart's single-site transfer rounding (`selectors.ts`'s `totals()`)
 * only agrees with a naive per-line rounding when every price is a multiple
 * of 10 minor units (see `storefront/pricing.ts`'s half-cent regression
 * comment for why that gap is real). This guard lives HERE rather than in
 * the cart module, because `cart/` cannot reach this module's wire fixtures
 * or `mapToProductView` across the module boundary (`no-restricted-imports`)
 * — the price data belongs to catalog, so catalog is what should fail loudly
 * the day a driftable price ships, not a distant test in a different module.
 */
describe("catalog price fixtures: the cart's single-rounding-site precondition", () => {
  it("every fixture price and compareAt is a multiple of 10 minor units", () => {
    const views = products.map((product) => mapToProductView(product));

    const amounts = views.flatMap((view) =>
      view.variants.flatMap((variant) =>
        variant.compareAt
          ? [variant.price.amount, variant.compareAt.amount]
          : [variant.price.amount],
      ),
    );

    // Guards against a vacuous pass: if the fixture ever loses its price
    // points, this proves the loop below actually ran against real data.
    expect(amounts.length).toBeGreaterThan(0);

    for (const amount of amounts) {
      expect(amount % 10).toBe(0);
    }
  });
});
