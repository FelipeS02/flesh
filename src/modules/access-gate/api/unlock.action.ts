"use server";

import { cookies, headers } from "next/headers";
import { readAccessGateConfig } from "./config";
import { createAttemptGuard, type AttemptGuard } from "./attempt.guard";
import { readClientKey } from "./client-key";
import { ACCESS_GATE_COOKIE_NAME } from "../domain/cookie-name";
import { constantTimeEqual, signToken } from "../domain/session";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type UnlockResult =
  | { ok: true }
  | { ok: false; error: "invalid-password" }
  | { ok: false; error: "too-many-attempts"; retryAfterMs: number };

type Dependencies = { guard: AttemptGuard };

// Module-level like checkout.service.ts's `defaultGuard` — the limiter has
// to outlive a single request to count attempts across requests, and stays
// injectable so tests can supply a fake clock instead of racing wall-clock time.
const defaultGuard = createAttemptGuard();

/**
 * Public mutation boundary: config reading, token signing and the cookie
 * write all stay server-only, mirroring `checkout.action.ts`'s split between
 * the thin exported action and its service.
 */
export async function unlockAccessGate(password: string, dependencies?: Dependencies): Promise<UnlockResult> {
  const config = readAccessGateConfig();

  // The gate being disabled (no password configured) is handled at the
  // proxy — this branch only guards a direct call to the action while a
  // deploy has the password unset, so it never dead-ends on a submit.
  if (!config.enabled) {
    return { ok: true };
  }

  const guard = dependencies?.guard ?? defaultGuard;
  const key = readClientKey(await headers());

  // Checked BEFORE the password comparison: otherwise a blocked client could
  // still use this endpoint as an oracle for whether its last guess was
  // right, by watching whether the response changes once it's over budget.
  const attempt = guard.check(key);
  if (attempt.blocked) {
    return { ok: false, error: "too-many-attempts", retryAfterMs: attempt.retryAfterMs };
  }

  if (!constantTimeEqual(password, config.password)) {
    guard.recordFailure(key);
    return { ok: false, error: "invalid-password" };
  }

  guard.reset(key);

  const expiresAt = Date.now() + THIRTY_DAYS_MS;
  const token = await signToken(expiresAt, config.secret);

  const store = await cookies();
  store.set(ACCESS_GATE_COOKIE_NAME, token, {
    httpOnly: true,
    // Derived from `NODE_ENV`, not hardcoded true — matches
    // `buyer-profile.cookie.ts`: a hardcoded `secure` cookie looks broken on
    // http://localhost, where secure-cookie handling is not guaranteed.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return { ok: true };
}
