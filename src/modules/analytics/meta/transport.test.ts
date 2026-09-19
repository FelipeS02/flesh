import { describe, expect, it, vi } from "vitest";
import type { AnalyticsEvent, AnalyticsItem } from "../events";
import { sendMetaEvent } from "./transport";

const item: AnalyticsItem = {
  item_id: "101",
  item_name: "SKELETONS BLOOD (M)",
  price: 45000,
  quantity: 1,
  currency: "ARS",
};

const addToCart: AnalyticsEvent = {
  name: "add_to_cart",
  params: { currency: "ARS", value: 45000, items: [item] },
};

const config = { pixelId: "1234567890123456" };

describe("sendMetaEvent", () => {
  it("tracks the mapped event and reports that it went out", () => {
    const fbq = vi.fn();

    expect(sendMetaEvent(addToCart, { config, fbq })).toBe(true);
    expect(fbq).toHaveBeenCalledWith("track", "AddToCart", {
      content_type: "product",
      content_ids: ["101"],
      contents: [{ id: "101", quantity: 1, item_price: 45000 }],
      value: 45000,
      currency: "ARS",
    });
  });

  it("stays silent when no pixel is configured", () => {
    const fbq = vi.fn();

    expect(sendMetaEvent(addToCart, { config: null, fbq })).toBe(false);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("stays silent when the pixel script has not installed fbq", () => {
    expect(sendMetaEvent(addToCart, { config, fbq: undefined })).toBe(false);
  });

  // The adapter drops these, and the transport must not turn a dropped event
  // into a call with an undefined name.
  it("sends nothing for an event Meta has no standard name for", () => {
    const fbq = vi.fn();
    const viewCart: AnalyticsEvent = {
      name: "view_cart",
      params: { currency: "ARS", value: 45000, items: [item] },
    };

    expect(sendMetaEvent(viewCart, { config, fbq })).toBe(false);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("tracks a pageview with no parameters", () => {
    const fbq = vi.fn();

    sendMetaEvent(
      { name: "page_view", params: { page_path: "/producto/x" } },
      { config, fbq },
    );

    expect(fbq).toHaveBeenCalledWith("track", "PageView", {});
  });
});
