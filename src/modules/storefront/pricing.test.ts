import { describe, expect, it } from "vitest";
import { applyRate, TRANSFER_RATE_BP } from "@/modules/catalog/client";
import { discountPercent, promoPriceView, transferPrice } from "./pricing";

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
    expect(TRANSFER_RATE_BP).toBe(1000);
  });

  /**
   * The regression that made this file delegate instead of computing.
   *
   * `Math.round(amount * 0.9)` and `amount - Math.round(amount * 0.1)` are not
   * the same function: they disagree on every amount whose tenth lands exactly
   * on a half cent, which is 10% of all amounts — 5, 15, 25, 35, 45 and so on.
   * $19,95 is the first one a merchant would plausibly type.
   *
   * While the storefront computed its own price, the PDP could show $17,96 for
   * a garment the cart totalled at $17,95.
   */
  it("agrees with the catalog policy on a half-cent amount, to the minor unit", () => {
    const halfCent = ars(1995);

    expect(transferPrice(halfCent)).toEqual(applyRate(halfCent, TRANSFER_RATE_BP));
    expect(transferPrice(halfCent).amount).toBe(1795);
  });

  it("agrees with the catalog policy across every amount that can disagree", () => {
    for (let amount = 5; amount <= 100_005; amount += 10) {
      expect(transferPrice(ars(amount))).toEqual(applyRate(ars(amount), TRANSFER_RATE_BP));
    }
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

describe("promoPriceView", () => {
  it("splits a markdown into its transfer current/previous prices and its raw-pair percent", () => {
    // compareAt (original, higher) 150.000; price (current, lower) 92.000.
    const view = promoPriceView(ars(9_200_000), ars(15_000_000));

    expect(view.current).toEqual({ amount: 8_280_000, currency: "ARS" });
    expect(view.previous).toEqual({ amount: 13_500_000, currency: "ARS" });
    // `discountPercent` returns the whole percent, unsigned — `DiscountBadge`
    // is what prepends the "-" a shopper reads.
    expect(view.percent).toBe(39);
  });

  it("reports no markdown at all when there is no compareAt", () => {
    const view = promoPriceView(ars(2_700_000), null);

    expect(view.previous).toBeNull();
    expect(view.percent).toBeNull();
  });
});
