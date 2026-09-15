import { describe, expect, it, vi } from "vitest";
import { createAttemptGuard } from "./attempt.guard";

describe("createAttemptGuard", () => {
  it("blocks a key only after it exhausts its own failure budget", () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 2, windowMs: 60_000 });

    expect(guard.check("1.1.1.1").blocked).toBe(false);
    guard.recordFailure("1.1.1.1");
    expect(guard.check("1.1.1.1").blocked).toBe(false);
    guard.recordFailure("1.1.1.1");
    expect(guard.check("1.1.1.1").blocked).toBe(true);
  });

  it("keeps one attacker from locking out every other visitor", () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 1, windowMs: 60_000 });

    guard.recordFailure("attacker");
    expect(guard.check("attacker").blocked).toBe(true);
    expect(guard.check("shopper").blocked).toBe(false);
  });

  it("reports how long the block still has to run", () => {
    const now = vi.fn(() => 1_000);
    const guard = createAttemptGuard({ now, limit: 1, windowMs: 60_000 });

    guard.recordFailure("1.1.1.1");
    expect(guard.check("1.1.1.1").retryAfterMs).toBe(60_000);
    now.mockReturnValue(31_000);
    expect(guard.check("1.1.1.1").retryAfterMs).toBe(30_000);
  });

  it("frees the key once its window has passed", () => {
    const now = vi.fn(() => 1_000);
    const guard = createAttemptGuard({ now, limit: 1, windowMs: 60_000 });

    guard.recordFailure("1.1.1.1");
    expect(guard.check("1.1.1.1").blocked).toBe(true);
    now.mockReturnValue(61_001);
    expect(guard.check("1.1.1.1").blocked).toBe(false);
  });

  it("clears the budget on reset, so one typo costs nothing after a correct password", () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 2, windowMs: 60_000 });

    guard.recordFailure("1.1.1.1");
    guard.reset("1.1.1.1");
    guard.recordFailure("1.1.1.1");
    expect(guard.check("1.1.1.1").blocked).toBe(false);
  });

  it("evicts expired keys instead of growing a Map for the life of the process", () => {
    const now = vi.fn(() => 1_000);
    const guard = createAttemptGuard({ now, limit: 5, windowMs: 60_000 });

    guard.recordFailure("a");
    guard.recordFailure("b");
    expect(guard.size()).toBe(2);

    now.mockReturnValue(61_001);
    guard.check("c");
    expect(guard.size()).toBe(0);
  });
});
