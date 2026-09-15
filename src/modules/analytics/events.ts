export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_cart",
  "view_cart",
  "remove_from_cart",
  "checkout_redirect",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type EcommerceEventName = Exclude<
  AnalyticsEventName,
  "page_view" | "checkout_redirect"
>;

export type AnalyticsItem = {
  // Always present: it is Tiendanube's variant id, which every catalog item
  // has, so there is no degraded shape for a consumer to branch on.
  item_id: string;
  item_name: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency: string;
};

export type AnalyticsEvent =
  | { name: "page_view"; params: { page_path: string } }
  | {
      name: EcommerceEventName;
      params: { currency: string; value: number; items: AnalyticsItem[] };
    }
  | {
      name: "checkout_redirect";
      params: { checkout_provider: "tiendanube" };
    };

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return EVENT_NAME_SET.has(value);
}
