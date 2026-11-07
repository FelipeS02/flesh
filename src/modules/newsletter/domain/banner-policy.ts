/**
 * How long a browsing session runs before the banner is offered.
 *
 * 10 s sits at the upper edge of the 6–10 s band where vendor data puts the
 * peak: Omnisend's 1.24B displays peak there, Sleeknote's best is ~6 s, and
 * Wisepops' 11–15 s window is the slow side. All of it is vendor-published
 * data, not an independent study (see the research note in
 * `odd/tasks/newsletter-emails.md`), which is why this is a single named
 * constant and not something a component hard-codes: it is meant to be tuned.
 *
 * The edge rather than the middle on purpose — a banner rising from the
 * bottom at 6 s lands while a first-time shopper is still reading the hero.
 */
export const BANNER_DELAY_MS = 10_000;

/** How long an X silences the banner: long enough not to nag, short enough to ask again. */
export const BANNER_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export type BannerInputs = {
  now: number;
  /** When this browsing session began (epoch ms); survives client navigations. */
  sessionStart: number;
  /** When the shopper last pressed X, or null if never. */
  dismissedAt: number | null;
  /** Subscribed from this browser at any point. */
  subscribed: boolean;
  /** The cookie notice is on screen or about to be. */
  cookieNoticePending: boolean;
};

export type BannerDecision =
  /** Offer it now. */
  | { kind: "show" }
  /** Offer it at `at` (epoch ms), if nothing changes before then. */
  | { kind: "at"; at: number }
  /** Not now; re-decide when an input changes. `reason` is for tests and debugging only. */
  | { kind: "hidden"; reason: "subscribed" | "dismissed" | "cookie-notice" };

/**
 * The whole "should the banner appear" rule as one pure function, so the
 * component only has to schedule and render what this says.
 *
 * Ranking is deliberate: a subscriber is done forever; a dismissal outranks
 * the cookie notice because it is the shopper's explicit word; and the notice
 * only holds the banner back, it never cancels it — once acknowledged the
 * delay that already elapsed is not owed again.
 */
export function decideBanner(inputs: BannerInputs): BannerDecision {
  const { now, sessionStart, dismissedAt, subscribed, cookieNoticePending } = inputs;

  if (subscribed) return { kind: "hidden", reason: "subscribed" };

  // `dismissedAt > now` is a clock that moved backwards (or a bad sync), not a
  // dismissal from the future. Trusting it would silence the banner until the
  // wall clock caught up, which can be years.
  if (dismissedAt !== null && dismissedAt <= now && now - dismissedAt < BANNER_DISMISS_MS) {
    return { kind: "hidden", reason: "dismissed" };
  }

  if (cookieNoticePending) return { kind: "hidden", reason: "cookie-notice" };

  const at = sessionStart + BANNER_DELAY_MS;

  return now >= at ? { kind: "show" } : { kind: "at", at };
}
