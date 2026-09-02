import { describe, expect, it } from "vitest";
import { discountPercent, TRANSFER_DISCOUNT_RATE, transferPrice } from "./pricing";

const ars = (amount: number) => ({ amount, currency: "ARS" });

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

describe("discountPercent", () => {
  it("reads the artboard's own promo card: 27.000 down to 18.900 is 30% off", () => {
    expect(discountPercent(ars(1_890_000), ars(2_700_000))).toBe(30);
  });

  it("says nothing when the product was never marked down", () => {
    expect(discountPercent(ars(1_890_000), null)).toBeNull();
  });

  it("refuses to advertise a discount that is not one", () => {
    // A `compareAt` at or below the price is bad merchant data, not a 0% or
    // negative promo. Printing either would be announcing a markdown that did
    // not happen.
    expect(discountPercent(ars(1_890_000), ars(1_890_000))).toBeNull();
    expect(discountPercent(ars(1_890_000), ars(1_000_000))).toBeNull();
  });

  it("will not compare two different currencies", () => {
    // Neither number means anything in terms of the other, so any percentage
    // here would be invented.
    expect(discountPercent(ars(1_890_000), { amount: 2_700_000, currency: "USD" })).toBeNull();
  });

  it("rounds to a whole percent, the way a badge is read", () => {
    // 27.000 -> 18.910 is 29.96%.
    expect(discountPercent(ars(1_891_000), ars(2_700_000))).toBe(30);
  });
});
