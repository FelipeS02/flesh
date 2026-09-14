import "server-only";
import { cookies } from "next/headers";
import type { CheckoutBuyer } from "../domain/line";

export const BUYER_COOKIE_NAME = "flesh_buyer";

/** The subset of `next/headers`' `cookies()` result this module needs — narrow enough to fake in a unit test without touching `next/headers` at all. */
type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

async function resolveStore(store?: CookieStore): Promise<CookieStore> {
  return store ?? (await cookies());
}

/**
 * Returns `unknown`, not `CheckoutBuyer | null` — schema validation lives in
 * `resolveBuyer` (checkout.service.ts), so the seam here can hand a tampered
 * value through untouched and the fail-closed path stays testable at that
 * single point (design D3, Interfaces note).
 */
export async function readBuyerCookie(store?: CookieStore): Promise<unknown> {
  const cookieStore = await resolveStore(store);
  const raw = cookieStore.get(BUYER_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * `secure` is derived from `NODE_ENV` rather than hardcoded true: hardcoding
 * it yields a cookie that works in production and looks broken in local dev,
 * where http://localhost cookie handling is not guaranteed (design D8).
 */
export async function writeBuyerCookie(buyer: CheckoutBuyer, store?: CookieStore): Promise<void> {
  const cookieStore = await resolveStore(store);
  cookieStore.set(BUYER_COOKIE_NAME, JSON.stringify(buyer), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
