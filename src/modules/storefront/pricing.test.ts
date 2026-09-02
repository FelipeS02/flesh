import { describe, expect, it } from "vitest";
import { TRANSFER_DISCOUNT_RATE, transferPrice } from "./pricing";

describe("transferPrice", () => {
  it("takes the brand's transfer discount off the list price", () => {
    const result = transferPrice({ amount: 2_700_000, currency: "ARS" });

    expect(result).toEqual({ amount: 2_430_000, currency: "ARS" });
  });

  it("rounds to a whole minor unit instead of emitting a fractional cent", () => {
    const result = transferPrice({ amount: 1_999_999, currency: "ARS" });

    expect(result.amount).toBe(1_799_999);
    expect(Number.isInteger(result.amount)).toBe(true);
  });

  it("is a discount of exactly the published rate", () => {
    expect(TRANSFER_DISCOUNT_RATE).toBe(0.1);
  });
});
