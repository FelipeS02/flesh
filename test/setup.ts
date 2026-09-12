import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { installObserverStubs } from "./fixtures/observers";
import { installMatchMediaStub, resetViewport } from "./fixtures/viewport";

// jsdom ships no `matchMedia` and neither observer. Installing them globally
// rather than per-file keeps a component that starts reading a breakpoint —
// or pulls in a library that observes one — from failing in a suite that
// never knew it had one.
//
// Guarded because this file is the setup for EVERY suite, and a few run under
// `@vitest-environment node` — server-side rendering with no DOM at all, such
// as the OpenGraph image routes. Stubbing a browser API there would be the
// first thing to crash, over a global those suites never touch.
const hasDom = typeof window !== "undefined";

if (hasDom) {
  installMatchMediaStub();
  installObserverStubs();
}

// React Testing Library does not auto-clean the jsdom document between
// tests under Vitest (that auto-cleanup is a Jest-specific convention).
// Without this, multiple renders in the same test file accumulate in the
// DOM and later `screen` queries can match more than one element.
afterEach(() => {
  if (!hasDom) return;

  cleanup();
  resetViewport();
});
