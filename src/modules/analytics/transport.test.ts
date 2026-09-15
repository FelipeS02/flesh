import { describe, expect, it, vi } from "vitest";
import { sendAnalyticsEvent } from "./transport";

const PAGE_VIEW = { name: "page_view", params: { page_path: "/producto/tee" } } as const;

describe("sendAnalyticsEvent", () => {
  it("is a no-op when analytics configuration is absent", () => {
    const gtag = vi.fn();

    expect(sendAnalyticsEvent(PAGE_VIEW, { config: null, gtag })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  // Omitting `config` is what the real trackers do, so this is the path that
  // actually ships — and the one that was silently dropping every event.
  it("resolves its configuration from the environment when none is injected", () => {
    const original = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-AMBIENT1";
    const gtag = vi.fn();

    try {
      expect(sendAnalyticsEvent(PAGE_VIEW, { gtag })).toBe(true);
      expect(gtag).toHaveBeenCalledWith("event", "page_view", {
        page_path: "/producto/tee",
      });
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = original;
    }
  });

  it("dispatches an allowlisted event once when configured", () => {
    const gtag = vi.fn();

    expect(
      sendAnalyticsEvent(PAGE_VIEW, {
        config: { measurementId: "G-ABC123" },
        gtag,
      }),
    ).toBe(true);
    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/producto/tee",
    });
  });
});
