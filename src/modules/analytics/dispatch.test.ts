import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_DESTINATIONS,
  dispatchAnalyticsEvent,
} from "./dispatch";
import type { AnalyticsEvent } from "./events";
import { sendMetaEvent } from "./meta/transport";
import { sendAnalyticsEvent } from "./transport";

const event: AnalyticsEvent = {
  name: "page_view",
  params: { page_path: "/" },
};

describe("dispatchAnalyticsEvent", () => {
  it("offers the same event to every destination", () => {
    const ga4 = vi.fn().mockReturnValue(true);
    const meta = vi.fn().mockReturnValue(true);

    dispatchAnalyticsEvent(event, [ga4, meta]);

    expect(ga4).toHaveBeenCalledWith(event);
    expect(meta).toHaveBeenCalledWith(event);
  });

  it("reports delivery when at least one destination took it", () => {
    expect(
      dispatchAnalyticsEvent(event, [() => false, () => true]),
    ).toBe(true);
  });

  it("reports no delivery when every destination declined", () => {
    expect(
      dispatchAnalyticsEvent(event, [() => false, () => false]),
    ).toBe(false);
  });

  // Both destinations are third-party globals. Before this, a pixel that threw
  // would have taken the GA4 event down with it — a measurement the storefront
  // has had working all along.
  it("keeps going when a destination throws", () => {
    const survivor = vi.fn().mockReturnValue(true);
    const thrower = () => {
      throw new Error("fbq exploded");
    };

    expect(dispatchAnalyticsEvent(event, [thrower, survivor])).toBe(true);
    expect(survivor).toHaveBeenCalledWith(event);
  });

  it("never lets a failing destination reach the caller", () => {
    expect(() =>
      dispatchAnalyticsEvent(event, [
        () => {
          throw new Error("gtag exploded");
        },
      ]),
    ).not.toThrow();
  });

  // Order is load-bearing: GA4 is the measurement that already works, so it
  // runs before the destination added later.
  it("ships with GA4 first and Meta second", () => {
    expect(ANALYTICS_DESTINATIONS).toEqual([sendAnalyticsEvent, sendMetaEvent]);
  });
});
