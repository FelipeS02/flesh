import "server-only";

// Window state lives in module-local memory, so it limits anything only where
// one instance is shared: the server. In a browser bundle it would become a
// per-tab counter reset by a reload; the marker turns that into a build error.
// (Same reasoning as the checkout guard — kept as its own copy because the cart
// module does not export it and a newsletter->cart import would invert the
// dependency direction.)

export type RateGuard = { consume: (key: string) => boolean; size: () => number };

type Options = { now?: () => number; limit: number; windowMs: number };

export function createRateGuard(options: Options): RateGuard {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { count: number; windowStart: number }>();

  // Expired windows are dropped on every call, otherwise a map keyed by client
  // address grows for the life of the process.
  function prune(current: number) {
    for (const [key, entry] of entries) {
      if (current - entry.windowStart >= options.windowMs) entries.delete(key);
    }
  }

  return {
    consume(key) {
      const current = now();
      prune(current);
      const entry = entries.get(key);
      const count = entry?.count ?? 0;
      if (count >= options.limit) return false;
      entries.set(key, { count: count + 1, windowStart: entry?.windowStart ?? current });
      return true;
    },
    size: () => entries.size,
  };
}
