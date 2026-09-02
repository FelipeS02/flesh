import type { VariantView } from "@/modules/catalog/client";
import type { CartView } from "../domain/line";

// `CartLineId` is the variant id, not a synthetic key: a variant's line is
// either removed or repriced, never both, so no linking key beyond the id
// the real store already assigns is ever needed. Same reasoning the
// storefront design used to reject a synthetic axis/value key (see
// `sdd/flesh-cart/design` D5) — and it is the id a real Tiendanube order
// would reference.
export type CartLineId = VariantView["id"];

/**
 * `redirect` and `rejected` have no implementation in this change (no
 * server exists yet, and rehydration-time drift already removes every
 * unavailable line before checkout can see one — see design D5). They stay
 * in the type because the LIVE checkout must be able to return them, and a
 * caller written against this port today should already have a branch
 * ready for the day it does. `unavailable` is the only outcome the local
 * implementation (`createLocalCheckout`, PR2b) can honestly produce.
 */
export type CheckoutOutcome =
  | { status: "redirect"; url: string }
  | { status: "rejected"; lines: CartLineId[] }
  | { status: "unavailable"; reason: string };

/**
 * The CTA is NEVER blocked client-side (spec: "Checkout CTA state
 * machine") — it always calls this and renders whatever comes back, so the
 * port is the only place "can this cart be bought" is decided.
 */
export interface CheckoutPort {
  startCheckout(cart: CartView): Promise<CheckoutOutcome>;
}
