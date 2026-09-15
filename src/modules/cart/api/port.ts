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
  /**
   * `draftOrderId` is null for any checkout that is not a Tiendanube draft
   * order — the local implementation has no such id and must not invent one.
   * Where it is present it identifies BOTH the draft and the order that draft
   * becomes, which is what lets the cart be emptied once that order exists.
   */
  | { status: "redirect"; url: string; draftOrderId: number | null }
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

/**
 * Deliberately carries nothing beyond what the skip-path UI needs to render
 * (spec "No unmasked leak") — never a raw name, surname, or email.
 */
export type BuyerProfileSummary = { hasProfile: boolean; maskedLabel: string | null };

export interface BuyerProfilePort {
  readSummary(): Promise<BuyerProfileSummary>;
}

/**
 * Answers the one question the storefront cannot answer for itself: the purchase
 * happens on the provider's domain, so a shopper who bought and a shopper who
 * abandoned the checkout return looking identical.
 *
 * Deliberately a bare boolean and no argument. The pending order is identified
 * server-side, so a caller cannot ask about someone else's, and nothing about
 * the order itself crosses back.
 */
export interface OrderStatusPort {
  hasCompletedCheckout(): Promise<boolean>;
}
