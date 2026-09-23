import { describe, expect, it } from "vitest";
import { createCheckoutRateGuard } from "../checkout.guard";

describe("createCheckoutRateGuard", () => {
  it("exhausting one key's budget does not refuse a different key", () => {
    const guard = createCheckoutRateGuard({ limit: 1 });
    expect(guard.consume("client-a")).toBe(true);
    expect(guard.consume("client-a")).toBe(false);
    expect(guard.consume("client-b")).toBe(true);
  });

  it("resets each key's own window independently once it elapses", () => {
    let now = 0;
    const guard = createCheckoutRateGuard({ limit: 1, windowMs: 60_000, now: () => now });
    expect(guard.consume("client-a")).toBe(true);
    expect(guard.consume("client-a")).toBe(false);
    now = 60_000;
    // client-b never consumed, so its window must not be affected by client-a's reset.
    expect(guard.consume("client-a")).toBe(true);
    expect(guard.consume("client-b")).toBe(true);
  });

  it("prunes expired windows so the map does not grow without bound", () => {
    let now = 0;
    const guard = createCheckoutRateGuard({ limit: 1, windowMs: 60_000, now: () => now });
    guard.consume("client-a");
    expect(guard.size()).toBe(1);
    now = 60_000;
    // A fresh consume for a different key must prune the expired client-a entry.
    guard.consume("client-b");
    expect(guard.size()).toBe(1);
  });
});
