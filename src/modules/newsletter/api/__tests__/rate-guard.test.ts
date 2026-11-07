import { describe, expect, it } from "vitest";
import { createRateGuard } from "../rate-guard";

describe("createRateGuard", () => {
  it("allows up to the limit per key, then refuses", () => {
    const guard = createRateGuard({ limit: 2, windowMs: 1_000, now: () => 0 });
    expect([guard.consume("a"), guard.consume("a"), guard.consume("a")]).toEqual([true, true, false]);
  });

  it("keeps clients independent so one cannot exhaust another's budget", () => {
    const guard = createRateGuard({ limit: 1, windowMs: 1_000, now: () => 0 });
    guard.consume("a");
    expect(guard.consume("b")).toBe(true);
  });

  it("opens a fresh window once the old one expires and prunes it", () => {
    let clock = 0;
    const guard = createRateGuard({ limit: 1, windowMs: 1_000, now: () => clock });
    guard.consume("a");
    clock = 1_000;
    expect(guard.consume("a")).toBe(true);
    expect(guard.size()).toBe(1);
  });
});
