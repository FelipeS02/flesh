import type { AnalyticsEvent, AnalyticsItem } from "../events";

export const META_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "AddToCart",
] as const;

export type MetaEventName = (typeof META_EVENT_NAMES)[number];

type MetaContent = { id: string; quantity: number; item_price: number };

export type MetaEventParams =
  | Record<string, never>
  | {
      content_type: "product";
      content_ids: string[];
      contents: MetaContent[];
      value: number;
      currency: string;
    };

export type MetaEvent = { name: MetaEventName; params: MetaEventParams };

/**
 * Only the canonical events Meta has a faithful standard name for.
 *
 * `view_item_list`, `select_item`, `view_cart` and `remove_from_cart` are
 * absent on purpose: Meta ships no standard event for any of them, and minting
 * custom names to make the list look complete fills the Events Manager with
 * events no campaign can optimise against, while costing the same maintenance
 * as the real ones.
 *
 * `Purchase` is absent for a different reason — Tiendanube's hosted checkout
 * owns it, on both the browser and the Conversions API, at payment-credited
 * timing. A second, uncoordinated sender here could not share their `event_id`
 * and would be counted twice.
 *
 * `checkout_redirect` is absent for a third reason: `InitiateCheckout` is sent
 * from the server, out of `startTiendanubeCheckout`. That is the only place
 * holding both the ad click id and the buyer's identity, so the server event
 * strictly dominates a browser one — which would have carried neither, and
 * would then have needed a shared `event_id` to avoid being counted twice.
 */
const STANDARD_NAMES: Partial<Record<AnalyticsEvent["name"], MetaEventName>> = {
  page_view: "PageView",
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
};

function contentParams(
  items: AnalyticsItem[],
  currency: string,
  value: number,
): MetaEventParams {
  return {
    content_type: "product",
    content_ids: items.map((item) => item.item_id),
    contents: items.map((item) => ({
      id: item.item_id,
      quantity: item.quantity,
      item_price: item.price,
    })),
    value,
    currency,
  };
}

/**
 * Projects one canonical analytics event onto Meta's vocabulary, or `null` when
 * Meta has nothing faithful to call it.
 *
 * Deliberately the only place that knows Meta's names and parameter shape, so
 * the 13 existing call sites keep emitting domain events and a third
 * destination stays a sibling of this file rather than an edit to all of them.
 */
export function toMetaEvent(event: AnalyticsEvent): MetaEvent | null {
  const name = STANDARD_NAMES[event.name];
  if (!name) return null;

  // Only PageView reaches this branch — the other two mapped events both
  // carry items. It takes no parameters, and inventing some for it would mean
  // sending Meta something GA4 was never given.
  if (!("items" in event.params)) return { name, params: {} };

  const { items, currency, value } = event.params;
  return { name, params: contentParams(items, currency, value) };
}
