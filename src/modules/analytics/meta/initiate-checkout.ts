import "server-only";
import { currencyExponent, type Money } from "@/modules/catalog/client";
import type { CapiEvent } from "./capi";
import { buildUserData } from "./user-data";

export type CheckoutLine = {
  variantId: number;
  quantity: number;
  price: Money;
};

export type InitiateCheckoutInput = {
  buyer: { firstName: string; lastName: string; email: string };
  lines: CheckoutLine[];
  nowMs: number;
  sourceUrl?: string;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

function majorUnits(price: Money): number {
  return price.amount / 10 ** currencyExponent(price.currency);
}

/**
 * Builds the one server event this storefront sends.
 *
 * It exists because of where it sits: `fbclid` arrives on the landing URL and
 * never reaches Tiendanube, while the buyer's identity is only known once the
 * checkout form is submitted. This is the single moment both are in the same
 * process, which is what lets Meta connect the ad click to the person.
 *
 * The browser sends no InitiateCheckout of its own, so there is no twin to
 * deduplicate against and no `event_id` to share.
 */
export function toInitiateCheckoutEvent(
  input: InitiateCheckoutInput,
): CapiEvent {
  const currency = input.lines[0]?.price.currency;
  if (!currency) throw new Error("An InitiateCheckout requires at least one line.");
  if (input.lines.some((line) => line.price.currency !== currency)) {
    throw new Error("A checkout cannot mix currencies.");
  }

  return {
    event_name: "InitiateCheckout",
    // Seconds. Meta discards an event stamped in milliseconds as one dated
    // tens of thousands of years from now, without complaining about it.
    event_time: Math.floor(input.nowMs / 1000),
    action_source: "website",
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
    user_data: buildUserData({
      buyer: input.buyer,
      fbc: input.fbc,
      fbp: input.fbp,
      clientIpAddress: input.clientIpAddress,
      clientUserAgent: input.clientUserAgent,
    }),
    custom_data: {
      currency,
      value: input.lines.reduce(
        (total, line) => total + majorUnits(line.price) * line.quantity,
        0,
      ),
      content_type: "product",
      content_ids: input.lines.map((line) => String(line.variantId)),
      contents: input.lines.map((line) => ({
        id: String(line.variantId),
        quantity: line.quantity,
        item_price: majorUnits(line.price),
      })),
    },
  };
}
