import type { Money, ProductView } from "@/modules/catalog/client";
import type { CartLineId } from "../api/port";

/**
 * The narrow, serializable slice of a product the client-side cart is
 * allowed to see. Deliberately excludes `descriptionHtml`, `axes`,
 * `compareAt`, and `tags` — same reasoning the storefront design applied to
 * `PurchasePanel` (design D1): the cart never renders a description, never
 * lets a shopper re-pick axes from inside the drawer, and the transfer
 * discount computes on `variant.price` (already the promotional price when
 * one is active — `compareAt` is not needed to know that).
 */
export type CartCatalogVariant = {
  id: CartLineId;
  combination: string[];
  price: Money;
  inStock: boolean;
};

export type CartCatalogProduct = {
  productId: number;
  slug: string;
  title: string;
  image: string | null;
  variants: CartCatalogVariant[];
};

export type CartCatalog = CartCatalogProduct[];

/**
 * Built once on the server (`layout.tsx`, task 2b.7) from the same
 * `ProductView[]` the rest of the storefront already reads, and passed down
 * as a plain, serializable prop — see design D1's "catalog reaches the
 * client as a narrow projection" decision. This is the ONLY place a
 * `ProductView` is ever converted into cart-shaped data.
 */
export function toCartCatalog(products: ProductView[]): CartCatalog {
  return products.map((product) => ({
    productId: product.id,
    slug: product.slug,
    title: product.title,
    image: product.images[0]?.src ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      combination: variant.combination,
      price: variant.price,
      inStock: variant.inStock,
    })),
  }));
}

/**
 * A variant's line is either removed or repriced, never both — see
 * `CartLineId`'s own note — so indexing by variant id, paired with its
 * OWN product, is exactly the lookup `reconcile` and `createLocalCheckout`
 * need and nothing more. Built fresh on every mount rather than memoised:
 * at catalog-fixture scale (a handful of products) this is not a cost
 * worth guarding.
 */
export function indexCartCatalog(
  catalog: CartCatalog,
): Map<CartLineId, { product: CartCatalogProduct; variant: CartCatalogVariant }> {
  const index = new Map<CartLineId, { product: CartCatalogProduct; variant: CartCatalogVariant }>();

  for (const product of catalog) {
    for (const variant of product.variants) {
      index.set(variant.id, { product, variant });
    }
  }

  return index;
}
