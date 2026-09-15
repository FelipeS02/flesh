import "server-only";

// Module-local state bundled into the browser would silently become a
// per-tab counter the caller resets by reloading, which is not a rate
// limit — the marker turns that mistake into a build error (mirrors
// checkout.guard.ts's reasoning for the same import).

export type AttemptGuard = {
  check: (key: string) => { blocked: boolean; retryAfterMs: number };
  recordFailure: (key: string) => void;
  reset: (key: string) => void;
  /** Exposes the pruned Map's size — the only way to observe from outside that eviction actually ran, not just that a single key's check returned unblocked. */
  size: () => number;
};

type Options = { limit?: number; windowMs?: number; now?: () => number };

type Entry = { count: number; windowStart: number };

/**
 * Fixed-window limiter keyed per client (per IP), not global. A global
 * limiter on the login gate means one attacker locks out every legitimate
 * visitor — you'd be DoS-ing yourself. Only failed attempts count against
 * the budget; a visitor who mistypes once and then gets it right must not
 * carry a burned budget, so a success calls `reset` instead of accruing.
 *
 * The window lives in module-local state, so it limits per running instance:
 * on a multi-instance deploy the real budget is `limit` x instances. Same
 * trade-off `checkout.guard.ts` already takes — a shared store is what would
 * move it off a single deployment.
 */
export function createAttemptGuard(options: Options = {}): AttemptGuard {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 15 * 60_000;
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();

  // A Map keyed by IP that's never pruned grows unbounded for the life of
  // the process — a slow memory leak. Expired windows are dropped here so
  // the map only ever holds keys with a live window.
  function prune(current: number) {
    for (const [key, entry] of entries) {
      if (current - entry.windowStart >= windowMs) entries.delete(key);
    }
  }

  return {
    check(key) {
      const current = now();
      prune(current);
      const entry = entries.get(key);
      if (!entry || current - entry.windowStart >= windowMs) return { blocked: false, retryAfterMs: 0 };
      if (entry.count < limit) return { blocked: false, retryAfterMs: 0 };
      return { blocked: true, retryAfterMs: entry.windowStart + windowMs - current };
    },
    recordFailure(key) {
      const current = now();
      const entry = entries.get(key);
      if (!entry || current - entry.windowStart >= windowMs) {
        entries.set(key, { count: 1, windowStart: current });
        return;
      }
      entry.count += 1;
    },
    reset(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}
