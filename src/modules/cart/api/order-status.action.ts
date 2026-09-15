"use server";

import { readPendingOrderCookie, clearPendingOrderCookie } from "./pending-order.cookie";
import { hasCompletedOrder } from "./order-status";
import { readTiendanubeConfig } from "@/modules/catalog";

/**
 * Public boundary for "did the cart I handed off actually get bought?".
 *
 * Takes no argument on purpose. The id lives in an httpOnly cookie, so a caller
 * cannot ask about an order that is not theirs — see `pending-order.cookie.ts`.
 * It answers with a bare boolean and never the id, the order number, or
 * anything else the record holds.
 */
export async function hasCompletedPendingCheckout(): Promise<boolean> {
  try {
    const pendingId = await readPendingOrderCookie();
    if (pendingId === null) return false;

    const completed = await hasCompletedOrder(pendingId, { config: readTiendanubeConfig() });
    // Cleared only on a definite yes. A "not yet" is left alone so a shopper who
    // wanders off mid-checkout and comes back later still gets asked about.
    if (completed) await clearPendingOrderCookie();
    return completed;
  } catch {
    return false;
  }
}
