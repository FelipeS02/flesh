/**
 * jsdom implements no layout, so it ships neither observer. Embla constructs
 * an `IntersectionObserver` during `init` and throws without one, which takes
 * down every test that renders a carousel — including the ones asserting
 * plain markup that never needed embla to be measured at all.
 *
 * These are inert on purpose: they satisfy construction and never fire. A
 * stub that invented entries would be reporting a layout jsdom does not have,
 * and any test trusting it would be proving nothing. Assertions that need a
 * real geometry belong in a browser, not here.
 */
class InertObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

export function installObserverStubs(): void {
  window.IntersectionObserver ??= InertObserver as unknown as typeof IntersectionObserver;
  window.ResizeObserver ??= InertObserver as unknown as typeof ResizeObserver;
}

/**
 * An `IntersectionObserver` a test drives by hand, for the one thing the
 * inert stub above cannot express: a component whose whole behaviour is
 * "before intersection" versus "after".
 *
 * Opt-in per suite rather than global, and it does NOT invent geometry —
 * the test states when intersection happened, which is a decision a test can
 * legitimately make about its own scenario. Call the returned `restore` in
 * `afterEach`, or the next suite inherits an observer that answers to
 * somebody else.
 */
export function installControllableIntersectionObserver(): {
  enter: () => void;
  observed: () => number;
  restore: () => void;
} {
  const original = window.IntersectionObserver;
  const live = new Set<{ callback: IntersectionObserverCallback; instance: object }>();
  let observed = 0;

  class ControllableObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(): void {
      observed += 1;
      live.add({ callback: this.callback, instance: this });
    }

    unobserve(): void {}

    disconnect(): void {
      for (const entry of live) {
        if (entry.instance === this) live.delete(entry);
      }
    }

    takeRecords(): [] {
      return [];
    }
  }

  window.IntersectionObserver =
    ControllableObserver as unknown as typeof IntersectionObserver;

  return {
    enter: () => {
      for (const { callback, instance } of [...live]) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          instance as IntersectionObserver,
        );
      }
    },
    observed: () => observed,
    restore: () => {
      live.clear();
      window.IntersectionObserver = original;
    },
  };
}
