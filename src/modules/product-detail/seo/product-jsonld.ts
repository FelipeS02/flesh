import { BRAND } from "@/lib/brand";
import type { ProductView, VariantView } from "@/modules/catalog/client";
import { formatMoneyDecimal } from "@/modules/catalog/client";
import { plainText } from "./plain-text";
import { productPath } from "./product-metadata";

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

export type ProductOffer = {
  "@type": "Offer";
  /** The colourway this offer prices, absent when the product has only one. */
  name?: string;
  url: string;
  price: string;
  priceCurrency: string;
  availability: string;
  itemCondition: string;
};

export type ProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description?: string;
  image: string[];
  url: string;
  brand: { "@type": "Brand"; name: string };
  offers: ProductOffer[];
};

/**
 * The PDP's structured data — what produces the price and stock rich results.
 *
 * Takes an absolute `base` where `productMetadata` takes none, and the
 * asymmetry is the point: Next resolves relative metadata against
 * `metadataBase`, but a JSON-LD block is opaque to it and reaches the crawler
 * exactly as written. A relative `src` in there resolves against nothing.
 *
 * **One offer per colourway, all on the same URL.** Sizes do not get their own
 * offer — a shopper reads "Noir, $27.000, in stock", not four size rows — and
 * no offer carries its `?color=` link, because the canonical deliberately
 * collapses every query permutation onto the bare product URL. Declaring a URL
 * here that we tell Google to ignore would contradict our own canonical.
 */
export function productJsonLd(product: ProductView, base: URL): ProductJsonLd {
  const url = new URL(productPath(product.slug), base).toString();
  const description = plainText(product.descriptionHtml) || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    image: [...product.images]
      .sort((a, b) => a.position - b.position)
      // Absolute already (a live Tiendanube CDN URL) or a `public/` path the
      // mock serves — `new URL` leaves the first alone and resolves the second.
      .map((image) => new URL(image.src, base).toString()),
    url,
    brand: { "@type": "Brand", name: BRAND },
    offers: colourwayOffers(product, url),
  };
}

/**
 * The exact string that goes inside `<script type="application/ld+json">`.
 *
 * The escape is NOT cosmetic. A JSON-LD block is injected with
 * `dangerouslySetInnerHTML`, and `JSON.stringify` happily emits a literal
 * `</script>` if a product title or description contains one — which closes
 * the tag early and hands the rest of the string to the HTML parser as markup.
 * The description is merchant-typed, so that is reachable input, and the
 * sanitiser does not help here: it guards `dangerouslySetInnerHTML` on the
 * DESCRIPTION, not this block.
 *
 * `<` is the same character to a JSON parser and inert to an HTML one.
 */
export function serializeJsonLd(jsonLd: ProductJsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

/**
 * The offers a shopper would recognise.
 *
 * A product is ONE colourway: colours are separate products, each with its own
 * page, its own stock and therefore its own offer at its own URL. So this
 * emits a single offer over every variant, named by the colour when the
 * garment declares one. Sizes are deliberately not enumerated as offers —
 * they narrow the same purchase at the same price rather than being separate
 * things to buy.
 */
function colourwayOffers(product: ProductView, url: string): ProductOffer[] {
  if (product.variants.length === 0) {
    return [];
  }

  const single = offer(product.variants, url);
  return [
    product.colourway ? { ...single, name: product.colourway.name } : single,
  ];
}

/**
 * One offer over a set of variants: priced at the cheapest, and in stock if
 * ANY of them is — a colourway you can still buy in one size is available,
 * and the size selector is where that gets narrowed down.
 */
function offer(variants: readonly VariantView[], url: string): ProductOffer {
  const cheapest = variants.reduce((lowest, variant) =>
    variant.price.amount < lowest.price.amount ? variant : lowest,
  );

  return {
    "@type": "Offer",
    url,
    price: formatMoneyDecimal(cheapest.price),
    priceCurrency: cheapest.price.currency,
    availability: variants.some((variant) => variant.inStock)
      ? IN_STOCK
      : OUT_OF_STOCK,
    itemCondition: "https://schema.org/NewCondition",
  };
}
