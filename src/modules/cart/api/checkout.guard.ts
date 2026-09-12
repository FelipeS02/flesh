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
