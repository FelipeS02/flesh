import { describe, expect, it } from "vitest";
import type { CartLine } from "./line";
import { itemCount, subtotal, totals } from "./selectors";

// Same rate as `catalog/lib/pricing.ts`'s `TRANSFER_RATE_BP` — inlined here
// rather than imported, so this test still pins the exact artboard figures
// even if the shared constant's value ever changes for a reason unrelated
// to this arithmetic.
const TRANSFER_RATE_BP = 1000;

function buildLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 101,
    variantId: 201,
    quantity: 1,
    price: { amount: 2_700_000, currency: "ARS" },
    ...overrides,
  };
}

describe("itemCount", () => {
  it("sums quantities across every line, not the number of lines", () => {
    const lines = [
      buildLine({ variantId: 201, quantity: 2 }),
      buildLine({ variantId: 202, quantity: 1 }),
    ];

    expect(itemCount(lines)).toBe(3);
  });

  it("returns 0 for an empty cart", () => {
    expect(itemCount([])).toBe(0);
  });
});

describe("subtotal", () => {
  it("multiplies each line's price by its quantity and sums them", () => {
    const lines = [buildLine({ variantId: 201, quantity: 3, price: { amount: 2_700_000, currency: "ARS" } })];

    expect(subtotal(lines)).toEqual({ amount: 8_100_000, currency: "ARS" });
  });

  it("sums across multiple distinct lines", () => {
    const lines = [
      buildLine({ variantId: 201, quantity: 1, price: { amount: 2_700_000, currency: "ARS" } }),
      buildLine({ variantId: 202, quantity: 2, price: { amount: 1_000_000, currency: "ARS" } }),
    ];

    expect(subtotal(lines)).toEqual({ amount: 4_700_000, currency: "ARS" });
  });

  it("returns a zero Money for an empty cart", () => {
    expect(subtotal([])).toEqual({ amount: 0, currency: "ARS" });
  });
});

describe("totals", () => {
  it("reproduces the artboard case exactly: 3 x $27.000 -> subtotal $81.000, discount $8.100, total $72.900", () => {
    const lines = [buildLine({ variantId: 201, quantity: 3, price: { amount: 2_700_000, currency: "ARS" } })];

    expect(totals(lines, TRANSFER_RATE_BP)).toEqual({
      subtotal: { amount: 8_100_000, currency: "ARS" },
      discount: { amount: 810_000, currency: "ARS" },
      total: { amount: 7_290_000, currency: "ARS" },
    });
  });

  it("applies the discount once to the combined subtotal, not per line", () => {
    const lines = [
      buildLine({ variantId: 201, quantity: 1, price: { amount: 1_995, currency: "ARS" } }),
      buildLine({ variantId: 202, quantity: 1, price: { amount: 1_995, currency: "ARS" } }),
    ];

    // 1_995 is exactly the amount `catalog/lib/pricing.ts` flags as the first
    // one whose per-line tenth lands on a half cent: round(1_995 * 10%) = 200
    // per line, so summing two lines first would give a discount of 400. The
    // combined subtotal (3_990) has no such remainder — round(3_990 * 10%)
    // is exactly 399 — which is the whole reason the policy applies the rate
    // once to the summed subtotal instead of per line.
    const result = totals(lines, TRANSFER_RATE_BP);

    expect(result.subtotal).toEqual({ amount: 3_990, currency: "ARS" });
    expect(result.discount).toEqual({ amount: 399, currency: "ARS" });
    expect(result.total).toEqual({ amount: 3_591, currency: "ARS" });
  });
});
