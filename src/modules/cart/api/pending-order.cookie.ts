import "server-only";
import { cookies } from "next/headers";

export const PENDING_ORDER_COOKIE_NAME = "flesh_pending_order";

/**
 * Long enough to outlive a checkout the shopper walks away from and finishes
 * later, short enough that an id nobody ever came back for stops being asked
 * about. Nothing breaks when it expires — the cart simply keeps its lines.
 */
const MAX_AGE_SECONDS = 60 * 60 * 24;

/** Same narrow shape `buyer-profile.cookie.ts` uses, for the same reason: it can be faked in a unit test without touching `next/headers`. */
type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

async function resolveStore(store?: CookieStore): Promise<CookieStore> {
  return store ?? (await cookies());
}

/**
 * The pending draft order id lives in an httpOnly cookie rather than beside the
 * cart in `localStorage`, and that is a security decision, not a convenience.
 *
 * If the browser held the id it would have to hand it back to ask "was this
 * bought?", and that endpoint would then answer for ANY id it was given —
 * letting anyone walk the id space and learn which orders exist. With the id
 * server-side the client can only ask about its own, because it cannot name
 * anyone else's.
 */
export async function writePendingOrderCookie(draftOrderId: number, store?: CookieStore): Promise<void> {
  const cookieStore = await resolveStore(store);
  cookieStore.set(PENDING_ORDER_COOKIE_NAME, String(draftOrderId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    // Derived rather than hardcoded for the same reason as the buyer cookie:
    // http://localhost does not reliably keep a `secure` cookie, so hardcoding
    // true yields something that works in production and looks broken in dev.
    secure: process.env.NODE_ENV === "production",
  });
}

/** Returns null for an absent, empty or non-numeric value — a tampered cookie simply means "nothing pending". */
export async function readPendingOrderCookie(store?: CookieStore): Promise<number | null> {
  const cookieStore = await resolveStore(store);
  const raw = cookieStore.get(PENDING_ORDER_COOKIE_NAME)?.value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Expiring in place rather than deleting keeps the store seam at `get`/`set`, which is all a fake has to implement. */
export async function clearPendingOrderCookie(store?: CookieStore): Promise<void> {
  const cookieStore = await resolveStore(store);
  cookieStore.set(PENDING_ORDER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}
