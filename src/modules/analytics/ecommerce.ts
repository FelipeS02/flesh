import { currencyExponent, type Money } from "@/modules/catalog/client";
import type {
  AnalyticsEvent,
  AnalyticsItem,
  EcommerceEventName,
} from "./events";

type AnalyticsItemInput = {
  /**
   * Tiendanube's own variant id, NOT the catalog SKU.
   *
   * Tiendanube exclusively owns the checkout half of the funnel and labels the
   * garment with this id. When we labelled the pre-checkout half with the SKU,
   * GA4 had no way to know the two halves were the same product: view_item and
   * add_to_cart landed on one item row, begin_checkout and purchase on another,
   * and no item-level funnel could ever close. Matching the hosted checkout is
   * what makes those reports join, so this follows Tiendanube if it ever moves.
   */
  variantId: number;
  itemName: string;
  combination: string[];
  price: Money;
  quantity: number;
};

const ECOMMERCE_EVENT_NAMES = new Set<EcommerceEventName>([
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_cart",
  "view_cart",
  "remove_from_cart",
]);

export function toAnalyticsItem(input: AnalyticsItemInput): AnalyticsItem {
  // The hosted checkout writes the qualified name the same way — "SKELETONS
  // BLOOD (M)" — so a GA4 report listing both halves of the funnel shows one
  // label per garment instead of a bare title next to a parenthesised one.
  const variant =
    input.combination.length > 0 ? input.combination.join(" / ") : null;

  const item: AnalyticsItem = {
    item_id: String(input.variantId),
    item_name: variant ? `${input.itemName} (${variant})` : input.itemName,
    price: input.price.amount / 10 ** currencyExponent(input.price.currency),
    quantity: input.quantity,
    currency: input.price.currency,
  };

  if (variant) item.item_variant = variant;

  return item;
}

export function createEcommerceEvent(
  name: EcommerceEventName,
  items: AnalyticsItem[],
): AnalyticsEvent {
  if (!ECOMMERCE_EVENT_NAMES.has(name)) {
    throw new Error(`Invalid analytics event name: ${String(name)}.`);
  }
  if (items.length === 0) {
    throw new Error("An ecommerce event requires at least one item.");
  }

  const currency = items[0]!.currency;
  if (items.some((item) => item.currency !== currency)) {
    throw new Error("An ecommerce event cannot mix currencies.");
  }

  return {
    name,
    params: {
      currency,
      value: items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
      items,
    },
  };
}
