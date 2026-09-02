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
