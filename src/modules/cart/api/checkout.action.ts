"use server";

import type { CheckoutOutcome } from "./port";
import { startTiendanubeCheckout as startCheckout } from "./checkout.service";

/** Public mutation boundary: implementation and credentials remain server-only. */
export async function startTiendanubeCheckout(input: unknown): Promise<CheckoutOutcome> {
  return startCheckout(input);
}
