import { describe, expect, it, vi } from "vitest";
import { createCheckoutRateGuard } from "../checkout.guard";

describe("createCheckoutRateGuard", () => {
  it("does not consume a slot until a schema-valid request reaches the guard", () => {
    const guard = createCheckoutRateGuard({ now: () => 1_000, limit: 2, windowMs: 60_000 });
    expect(guard.consume()).toBe(true);
    expect(guard.consume()).toBe(true);
    expect(guard.consume()).toBe(false);
  });

  it("opens a fresh fixed window without calling external dependencies", () => {
    const now = vi.fn(() => 1_000);
    const guard = createCheckoutRateGuard({ now, limit: 1, windowMs: 60_000 });
    expect(guard.consume()).toBe(true);
    expect(guard.consume()).toBe(false);
    now.mockReturnValue(61_000);
    expect(guard.consume()).toBe(true);
  });
});
