import "server-only";

// The limiter's window lives in module-local state, so it only limits anything
// where there is one shared instance: the server. Bundled into the browser it
// would silently become a per-tab counter that the caller resets by reloading,
// which is not a rate limit. The marker turns that mistake into a build error.

export type CheckoutRateGuard = { consume: (key: string) => boolean; size: () => number };

type Options = { now?: () => number; limit?: number; windowMs?: number };

type Entry = { count: number; windowStart: number };

/**
 * Fixed-window limiter keyed per client, not global — a single shared
 * counter meant to protect the Tiendanube budget turned into a site-wide
 * off switch, because one anonymous client's calls could exhaust the
 * budget every other shopper's checkout also drew from (mirrors
 * `attempt.guard.ts`'s per-key reasoning for the same failure mode).
 */
export function createCheckoutRateGuard(options: Options = {}): CheckoutRateGuard {
  const now = options.now ?? Date.now;
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const entries = new Map<string, Entry>();

  // A Map keyed by client that's never pruned grows unbounded for the life
  // of the process — a slow memory leak. Expired windows are dropped here
  // so the map only ever holds keys with a live window.
  function prune(current: number) {
    for (const [key, entry] of entries) {
      if (current - entry.windowStart >= windowMs) entries.delete(key);
    }
  }

  return {
    consume(key) {
      const current = now();
      prune(current);
      const entry = entries.get(key);
      const fresh = !entry || current - entry.windowStart >= windowMs;
      const count = fresh ? 0 : entry.count;
      if (count >= limit) return false;
      entries.set(key, { count: count + 1, windowStart: fresh ? current : entry.windowStart });
      return true;
    },
    size() {
      return entries.size;
    },
  };
}
