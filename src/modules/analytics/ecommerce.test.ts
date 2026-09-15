import { describe, expect, it } from "vitest";
import { createEcommerceEvent, toAnalyticsItem } from "./ecommerce";

const PRICE = { amount: 2_700_000, currency: "ARS" };

describe("toAnalyticsItem", () => {
  // Identity here is not ours to choose: Tiendanube owns the checkout half of
  // the funnel and labels the same garment `item_id: "1593005790"` (its variant
  // id) and `item_name: "SKELETONS BLOOD (M)"`. Emitting the SKU and a bare
  // title instead made GA4 read the pre-checkout and checkout events as two
  // different products, so view_item and purchase never met in one report.
  it("identifies an item exactly as the hosted checkout does", () => {
    expect(
      toAnalyticsItem({
        variantId: 1_593_005_790,
        itemName: "Remera Classic",
        combination: ["M", "Negro"],
        price: PRICE,
        quantity: 2,
      }),
    ).toEqual({
      item_id: "1593005790",
      item_name: "Remera Classic (M / Negro)",
      item_variant: "M / Negro",
      price: 27000,
      quantity: 2,
      currency: "ARS",
    });
  });

  it("leaves the title alone when a product has no axes to qualify it", () => {
    expect(
      toAnalyticsItem({
        variantId: 42,
        itemName: "Remera unica",
        combination: [],
        price: PRICE,
        quantity: 1,
      }),
    ).toEqual({
      item_id: "42",
      item_name: "Remera unica",
      price: 27000,
      quantity: 1,
      currency: "ARS",
    });
  });
});

describe("createEcommerceEvent", () => {
  it("creates an allowlisted PII-free event with totals derived from its items", () => {
    const item = toAnalyticsItem({
      variantId: 1_593_005_790,
      itemName: "Remera Classic",
      combination: ["M"],
      price: PRICE,
      quantity: 2,
    });

    const event = createEcommerceEvent("add_to_cart", [item]);

    expect(event).toEqual({
      name: "add_to_cart",
      params: { currency: "ARS", value: 54000, items: [item] },
    });
    expect(JSON.stringify(event)).not.toMatch(/email|firstName|lastName|checkout_url/i);
  });

  it("rejects hosted-checkout ownership names even if an untyped caller supplies one", () => {
    const item = toAnalyticsItem({
      variantId: 42,
      itemName: "Remera Classic",
      combination: [],
      price: PRICE,
      quantity: 1,
    });

    expect(() =>
      createEcommerceEvent("purchase" as "add_to_cart", [item]),
    ).toThrow(/event name/i);
  });
});
