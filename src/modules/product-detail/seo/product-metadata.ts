import type { Metadata } from "next";
import { BRAND, BRAND_LOCALE } from "@/lib/brand";
import type { ProductView } from "@/modules/catalog/client";
import { plainText, truncate } from "./plain-text";

/**
 * Google truncates a snippet around here. Writing to the limit rather than
 * letting the engine cut means the ellipsis lands on a word we chose.
 */
const DESCRIPTION_LIMIT = 160;

/** The bare product URL — the one canonical address for every variant of it. */
export function productPath(slug: string): string {
  return `/producto/${slug}`;
}

/**
 * The PDP's per-product metadata.
 *
 * Everything here is RELATIVE on purpose. `metadataBase` in the root layout
 * resolves it, so the domain lives in exactly one place instead of being
 * threaded through every builder — which is also why this function needs no
 * base URL argument and stays trivially testable.
 *
 * The canonical is not optional decoration: the variant selection lives in
 * query params (`?talle=m&color=noir`), so without it every permutation reads
 * to a crawler as a separate page with duplicate content.
 *
 * The share image is NOT here, and that omission is load-bearing: Next folds
 * the `opengraph-image.tsx` route's tags in only when this level declares no
 * `images` of its own (`next/dist/lib/metadata/resolve-metadata.js`). Naming
 * the route's URL here would win one `og:image` and lose the `width`,
 * `height`, `type` and `alt` that come with it.
 */
export function productMetadata(product: ProductView): Metadata {
  const canonical = productPath(product.slug);
  const description =
    truncate(plainText(product.descriptionHtml), DESCRIPTION_LIMIT) || undefined;
  return {
    title: product.title,
    description,
    alternates: { canonical },
    // Set wholesale, not merged: a child segment that declares `openGraph`
    // REPLACES the parent's rather than extending it, so `siteName` and
    // `locale` have to be restated here or the PDP would ship without them.
    openGraph: {
      title: product.title,
      description,
      url: canonical,
      siteName: BRAND,
      locale: BRAND_LOCALE,
      type: "website",
    },
  };
}

