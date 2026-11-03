import { describe, expect, it } from "vitest";
import {
  BANNER_DELAY_MS,
  BANNER_DISMISS_MS,
  decideBanner,
  type BannerInputs,
} from "../banner-policy";

const START = 1_000_000;

function inputs(overrides: Partial<BannerInputs> = {}): BannerInputs {
  return {
    now: START,
    sessionStart: START,
    dismissedAt: null,
    subscribed: false,
    cookieNoticePending: false,
    ...overrides,
  };
}

describe("decideBanner", () => {
  it("waits for the delay counted from the session start", () => {
    expect(decideBanner(inputs())).toEqual({ kind: "at", at: START + BANNER_DELAY_MS });
  });

  it("keeps the same target as time passes, so a re-evaluation never restarts the clock", () => {
    expect(decideBanner(inputs({ now: START + 4_000 }))).toEqual({
      kind: "at",
      at: START + BANNER_DELAY_MS,
    });
  });

  it("shows once the delay has elapsed, exactly on the boundary included", () => {
    expect(decideBanner(inputs({ now: START + BANNER_DELAY_MS }))).toEqual({ kind: "show" });
    expect(decideBanner(inputs({ now: START + BANNER_DELAY_MS + 1 }))).toEqual({ kind: "show" });
  });

  it("is never shown to someone who already subscribed, however long ago", () => {
    expect(decideBanner(inputs({ subscribed: true, now: START + 10 * BANNER_DISMISS_MS }))).toEqual({
      kind: "hidden",
      reason: "subscribed",
    });
  });

  it("stays hidden for the dismissal window after an X", () => {
    const dismissedAt = START + 20_000;

    expect(
      decideBanner(inputs({ dismissedAt, now: dismissedAt + BANNER_DISMISS_MS - 1 })),
    ).toEqual({ kind: "hidden", reason: "dismissed" });
  });

  it("comes back once the dismissal window is over", () => {
    const dismissedAt = START - BANNER_DISMISS_MS - 1;

    expect(decideBanner(inputs({ dismissedAt, now: START + BANNER_DELAY_MS }))).toEqual({
      kind: "show",
    });
  });

  it("treats a dismissal stamped in the future as a clock skew, not as a lifetime ban", () => {
    // A device clock fixed after a bad sync must not silence the banner for
    // years: a timestamp ahead of `now` is ignored rather than trusted.
    expect(
      decideBanner(inputs({ dismissedAt: START + 10 * BANNER_DISMISS_MS, now: START + BANNER_DELAY_MS })),
    ).toEqual({ kind: "show" });
  });

  it("holds back while the cookie notice is pending, even after the delay", () => {
    expect(
      decideBanner(inputs({ cookieNoticePending: true, now: START + 3 * BANNER_DELAY_MS })),
    ).toEqual({ kind: "hidden", reason: "cookie-notice" });
  });

  it("shows immediately when the notice is acknowledged after the delay already passed", () => {
    expect(
      decideBanner(inputs({ cookieNoticePending: false, now: START + 3 * BANNER_DELAY_MS })),
    ).toEqual({ kind: "show" });
  });

  it("ranks subscribed above dismissed above the cookie notice", () => {
    expect(
      decideBanner(inputs({ subscribed: true, dismissedAt: START, cookieNoticePending: true })),
    ).toEqual({ kind: "hidden", reason: "subscribed" });
    expect(decideBanner(inputs({ dismissedAt: START, cookieNoticePending: true }))).toEqual({
      kind: "hidden",
      reason: "dismissed",
    });
  });

  it("uses a 10 second delay and a 14 day dismissal", () => {
    expect(BANNER_DELAY_MS).toBe(10_000);
    expect(BANNER_DISMISS_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
