"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import Link from "next/link";
import type { ProductView, VariantView } from "@/modules/catalog/client";
import { createEcommerceEvent, toAnalyticsItem } from "./ecommerce";
import { dispatchAnalyticsEvent } from "./dispatch";
import type { AnalyticsEvent, AnalyticsItem } from "./events";

type Send = (event: AnalyticsEvent) => unknown;

function selectedItem(product: ProductView): AnalyticsItem {
  const variant =
    product.variants.find(
      (candidate) => candidate.id === product.defaultVariantId,
    ) ?? product.variants[0]!;

  return variantItem(product.title, variant);
}

export function variantItem(
  itemName: string,
  variant: VariantView,
  quantity = 1,
): AnalyticsItem {
  return toAnalyticsItem({
    variantId: variant.id,
    itemName,
    combination: variant.combination,
    price: variant.price,
    quantity,
  });
}

export function CatalogViewTracker({
  products,
  send = dispatchAnalyticsEvent,
}: {
  products: ProductView[];
  send?: Send;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || products.length === 0) return;
    sent.current = true;
    send(createEcommerceEvent("view_item_list", products.map(selectedItem)));
  }, [products, send]);

  return null;
}

export function ProductViewTracker({
  product,
  send = dispatchAnalyticsEvent,
}: {
  product: ProductView;
  send?: Send;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    send(createEcommerceEvent("view_item", [selectedItem(product)]));
  }, [product, send]);

  return null;
}

type ProductAnalyticsLinkProps = ComponentProps<typeof Link> & {
  product: ProductView;
  send?: Send;
};

export function ProductAnalyticsLink({
  product,
  send = dispatchAnalyticsEvent,
  onClick,
  ...props
}: ProductAnalyticsLinkProps) {
  return (
    <Link
      {...props}
      data-analytics-select-item=""
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          send(createEcommerceEvent("select_item", [selectedItem(product)]));
        }
      }}
    />
  );
}
