import type { Metadata } from "next";
import { BRAND, BRAND_LOCALE } from "@/lib/brand";
import type { ImageView, ProductView } from "@/modules/catalog/client";
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
 */
export function productMetadata(product: ProductView): Metadata {
  const canonical = productPath(product.slug);
  const description =
    truncate(plainText(product.descriptionHtml), DESCRIPTION_LIMIT) || undefined;
  const cover = coverImage(product.images);

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
      // Omitted rather than defaulted: a share card with a placeholder is
      // worse than one the platform renders from the page itself.
      images: cover ? [{ url: cover.src }] : undefined,
    },
  };
}

/**
 * The share image is the first photo BY POSITION, matching what the gallery
 * shows first — array order is the wire's, and the mapper does not promise it.
 */
function coverImage(images: readonly ImageView[]): ImageView | null {
  return [...images].sort((a, b) => a.position - b.position)[0] ?? null;
}
