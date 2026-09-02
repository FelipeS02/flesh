import { describe, expect, it } from "vitest";
import { applyRate, transferBreakdown } from "./pricing";

// Basis points, never a float rate: 1000 bp === 10%. See the module comment
// in `pricing.ts` for why a float rate is rejected outright — the same
// precision hazard `money.ts` is hand-rolled to avoid.

describe("transferBreakdown", () => {
  it("reproduces the artboard exactly: 3 x $27.000, 10% off, zero drift", () => {
    // 3 x $27.000 = $81.000 subtotal (integer minor units: 3 x 2_700_000).
    const subtotal = { amount: 8_100_000, currency: "ARS" };

    const result = transferBreakdown(subtotal, 1000);

    expect(result.discount).toEqual({ amount: 810_000, currency: "ARS" });
    expect(result.total).toEqual({ amount: 7_290_000, currency: "ARS" });
    // Zero drift: discount + total must reconstruct the subtotal exactly.
    expect(result.discount.amount + result.total.amount).toBe(
      subtotal.amount,
    );
  });

  it("computes the discount on the price actually passed in, not any original", () => {
    // Promo-stacking rule: the transfer rate applies to a variant's current
    // EFFECTIVE price (its `variant.price`, already promotional if a promo
    // is active), never to `compareAt`. This function only ever sees one
    // Money value — proving it produces the promotional figure and NOT the
    // pre-promotion figure is what the promo-stacking rule reduces to at
    // this layer: callers must pass `variant.price`, and the math never
    // reaches for a second, higher number.
    const promotionalPrice = { amount: 2_700_000, currency: "ARS" }; // $27.000, already marked down
    const originalPrice = { amount: 3_000_000, currency: "ARS" }; // $30.000, pre-promotion

    const fromPromotional = transferBreakdown(promotionalPrice, 1000);
    const fromOriginal = transferBreakdown(originalPrice, 1000);

    expect(fromPromotional.discount).toEqual({
      amount: 270_000,
      currency: "ARS",
    });
    expect(fromPromotional.discount.amount).not.toBe(
      fromOriginal.discount.amount,
    );
  });

  it("rounds a fractional minor-unit discount to the nearest integer", () => {
    // 3% of 1001 minor units = 30.03 -> rounds to 30, never a float leak.
    const subtotal = { amount: 1001, currency: "ARS" };

    const result = transferBreakdown(subtotal, 300);

    expect(Number.isInteger(result.discount.amount)).toBe(true);
    expect(result.discount).toEqual({ amount: 30, currency: "ARS" });
    expect(result.total).toEqual({ amount: 971, currency: "ARS" });
  });
});

describe("applyRate", () => {
  it("returns the price after the rate is taken off, integer minor units only", () => {
    const price = { amount: 2_700_000, currency: "ARS" };

    const result = applyRate(price, 1000);

    expect(result).toEqual({ amount: 2_430_000, currency: "ARS" });
  });

  it("returns the same amount unchanged for a zero rate", () => {
    const price = { amount: 1_999, currency: "ARS" };

    const result = applyRate(price, 0);

    expect(result).toEqual({ amount: 1_999, currency: "ARS" });
  });
});
