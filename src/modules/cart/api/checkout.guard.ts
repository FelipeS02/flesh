import "server-only";

// The limiter's window lives in module-local state, so it only limits anything
// where there is one shared instance: the server. Bundled into the browser it
// would silently become a per-tab counter that the caller resets by reloading,
// which is not a rate limit. The marker turns that mistake into a build error.

export type CheckoutRateGuard = { consume: () => boolean };

type Options = { now?: () => number; limit?: number; windowMs?: number };

/** Fixed-window limiter for the single-instance development deployment. */
export function createCheckoutRateGuard(options: Options = {}): CheckoutRateGuard {
  const now = options.now ?? Date.now;
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  let windowStart = now();
  let used = 0;

  return {
    consume() {
      const current = now();
      if (current - windowStart >= windowMs) {
        windowStart = current;
        used = 0;
      }
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}
