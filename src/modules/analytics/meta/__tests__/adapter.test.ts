import { describe, expect, it } from "vitest";
import type { AnalyticsEvent, AnalyticsItem } from "../../events";
import { toMetaEvent } from "../adapter";

const shirt: AnalyticsItem = {
  item_id: "101",
  item_name: "SKELETONS BLOOD (M)",
  item_variant: "M",
  price: 45000,
  quantity: 2,
  currency: "ARS",
};

const cap: AnalyticsItem = {
  item_id: "202",
  item_name: "BONE CAP",
  price: 20000,
  quantity: 1,
  currency: "ARS",
};

function ecommerce(
  name: Extract<AnalyticsEvent, { params: { items: AnalyticsItem[] } }>["name"],
  items: AnalyticsItem[],
): AnalyticsEvent {
  return {
    name,
    params: {
      currency: items[0]!.currency,
      value: items.reduce((total, i) => total + i.price * i.quantity, 0),
      items,
    },
  };
}

describe("toMetaEvent", () => {
  it("maps a product view to ViewContent with Meta's content parameters", () => {
    expect(toMetaEvent(ecommerce("view_item", [shirt]))).toEqual({
      name: "ViewContent",
      params: {
        content_type: "product",
        content_ids: ["101"],
        contents: [{ id: "101", quantity: 2, item_price: 45000 }],
        value: 90000,
        currency: "ARS",
      },
    });
  });

  it("maps an add to cart, carrying every line", () => {
    expect(toMetaEvent(ecommerce("add_to_cart", [shirt, cap]))).toEqual({
      name: "AddToCart",
      params: {
        content_type: "product",
        content_ids: ["101", "202"],
        contents: [
          { id: "101", quantity: 2, item_price: 45000 },
          { id: "202", quantity: 1, item_price: 20000 },
        ],
        value: 110000,
        currency: "ARS",
      },
    });
  });

  it("maps a pathname change to PageView, which takes no parameters", () => {
    expect(
      toMetaEvent({ name: "page_view", params: { page_path: "/producto/x" } }),
    ).toEqual({ name: "PageView", params: {} });
  });

  /**
   * InitiateCheckout is sent from the server instead, out of
   * `startTiendanubeCheckout`, which is the only place holding both the ad
   * click id and the buyer's identity. A browser twin would carry neither and
   * would then need a shared event_id to avoid being counted twice.
   */
  it("leaves the checkout handoff to the server", () => {
    expect(
      toMetaEvent({
        name: "checkout_redirect",
        params: { checkout_provider: "tiendanube" },
      }),
    ).toBeNull();
  });

  // Meta has no standard event for these. Inventing custom ones would fill the
  // Events Manager with names no campaign can optimise against.
  it("drops the events Meta has no faithful standard name for", () => {
    for (const name of [
      "view_item_list",
      "select_item",
      "view_cart",
      "remove_from_cart",
    ] as const) {
      expect(toMetaEvent(ecommerce(name, [shirt]))).toBeNull();
    }
  });

  it("never emits Purchase, which the hosted checkout owns", () => {
    const names = (
      [
        "page_view",
        "view_item_list",
        "select_item",
        "view_item",
        "add_to_cart",
        "view_cart",
        "remove_from_cart",
        "checkout_redirect",
      ] as const
    ).map((name) =>
      name === "page_view"
        ? toMetaEvent({ name, params: { page_path: "/" } })
        : name === "checkout_redirect"
          ? toMetaEvent({ name, params: { checkout_provider: "tiendanube" } })
          : toMetaEvent(ecommerce(name, [shirt])),
    );

    expect(names.map((event) => event?.name)).not.toContain("Purchase");
  });
});
