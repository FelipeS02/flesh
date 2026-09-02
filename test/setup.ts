import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library does not auto-clean the jsdom document between
// tests under Vitest (that auto-cleanup is a Jest-specific convention).
// Without this, multiple renders in the same test file accumulate in the
// DOM and later `screen` queries can match more than one element.
afterEach(() => {
  cleanup();
});
