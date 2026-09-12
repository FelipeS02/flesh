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
 * `rejected` names the variants checkout refused, from either of the two
 * authorities that can refuse one: the server-side catalog projection, and
 * the provider itself, which revalidates stock when the order is created
 * and can therefore contradict a cached read. `unavailable` is the single
 * generic failure and deliberately carries no provider detail — a caller
 * can only ask the buyer to retry. The local implementation
 * (`createLocalCheckout`, PR2b) can honestly produce `unavailable` alone.
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
