import type { Money, ProductView } from "@/modules/catalog/client";
import type { CartLineId } from "../api/port";

/**
 * The narrow, serializable slice of a product the client-side cart is
 * allowed to see. Deliberately excludes `descriptionHtml`, `axes`, and
 * `tags`: the cart never renders a description and never lets a shopper
 * re-pick axes from inside the drawer.
 *
 * `compareAt` used to be on that exclusion list, for the reason that the
 * transfer discount computes on `variant.price` — already the promotional
 * price when one is active — so the original was not needed to know what to
 * charge. That reasoning was about ARITHMETIC and it still holds: nothing in
 * this module prices off `compareAt`. What changed is that the drawer now
 * has to SAY a garment is marked down (struck previous price plus a percent
 * badge, see `ui/line-row.tsx`), and a markdown cannot be announced from the
 * effective price alone — announcing it needs the price it was marked down
 * FROM.
 *
 * It is display-only and nullable, and it stops here. `CartLine` deliberately
 * does not carry it (see `domain/line.ts`): a line's `price` is a drift
 * WITNESS for `reconcile`, and a second price on that record would be a
 * field `reconcile` has no rule for.
 */
export type CartCatalogVariant = {
  id: CartLineId;
  sku: string | null;
  combination: string[];
  price: Money;
  compareAt: Money | null;
  inStock: boolean;
  // Carried through so `purchaseLimit` (catalog/client.ts) can be computed
  // client-side, exactly as it is for the PDP's own add-to-cart control —
  // otherwise the drawer's stepper would have no ceiling to clamp against.
  stockManagement: boolean;
  stock: number | null;
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
      sku: variant.sku,
      combination: variant.combination,
      price: variant.price,
      compareAt: variant.compareAt,
      inStock: variant.inStock,
      stockManagement: variant.stockManagement,
      stock: variant.stock,
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
