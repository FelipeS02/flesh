"use server";

import type { CheckoutOutcome } from "./port";
import { startTiendanubeCheckout as startCheckout } from "./checkout.service";
import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { CHECKOUT_FAILURE_REASON } from "./checkout-messages";

/** Public mutation boundary: implementation and credentials remain server-only. */
export async function startTiendanubeCheckout(input: unknown): Promise<CheckoutOutcome> {
  // The gate lives in the proxy, which does not cover this POST path (an
  // action is dispatched by id, reachable from any route including
  // `/acceso`) — refuse with the same generic failure every other checkout
  // rejection already returns, so an ungated caller learns nothing new.
  if (!(await isAccessGranted())) {
    return { status: "unavailable", reason: CHECKOUT_FAILURE_REASON };
  }

  return startCheckout(input);
}
