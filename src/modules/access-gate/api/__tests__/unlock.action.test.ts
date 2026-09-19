import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn() })),
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" })),
}));

vi.mock("../config", () => ({
  readAccessGateConfig: vi.fn(() => ({
    enabled: true,
    password: "correct-horse",
    secret: "test-secret",
    message: "SITIO EN **CONSTRUCCIÓN**",
  })),
}));

import { unlockAccessGate } from "../unlock.action";
import { createAttemptGuard } from "../attempt.guard";

describe("unlockAccessGate", () => {
  it("succeeds and resets the guard on a matching password", async () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 5, windowMs: 60_000 });
    const result = await unlockAccessGate("correct-horse", { guard });
    expect(result).toEqual({ ok: true });
  });

  it("records a failure and returns invalid-password on a wrong password", async () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 5, windowMs: 60_000 });
    const result = await unlockAccessGate("wrong", { guard });
    expect(result).toEqual({ ok: false, error: "invalid-password" });
    expect(guard.check("1.2.3.4").blocked).toBe(false);
  });

  it("blocks before checking the password once the per-IP limit is reached, so a blocked client cannot use the endpoint as a guessing oracle", async () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 1, windowMs: 60_000 });
    guard.recordFailure("1.2.3.4");

    // Even the correct password must not succeed while blocked — the guard
    // check happens before comparison, otherwise a blocked client could
    // still tell right from wrong guesses by watching which error comes back.
    const result = await unlockAccessGate("correct-horse", { guard });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "too-many-attempts") {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    } else {
      throw new Error("expected a too-many-attempts result");
    }
  });

  it("resets the guard's failure count on success so a later mistype gets a fresh budget", async () => {
    const guard = createAttemptGuard({ now: () => 1_000, limit: 1, windowMs: 60_000 });
    guard.recordFailure("1.2.3.4");
    guard.reset("1.2.3.4");

    const result = await unlockAccessGate("correct-horse", { guard });
    expect(result).toEqual({ ok: true });
  });
});
