import type { TiendanubeProduct, TiendanubeVariant } from "../api/types";
import { pick } from "../lib/locale";
import { parseMoney } from "../lib/money";
import { toSafeHtml } from "../lib/sanitize";
import type { Colourway } from "./colourway";
import {
  CatalogContractError,
  type ImageView,
  type OptionAxis,
  type ProductView,
  type VariantView,
} from "./product";

/**
 * The anti-corruption mapper: turns a wire-shaped Tiendanube product into
 * the domain `ProductView`. This is where every wire quirk gets resolved
 * once — language-keyed objects, price strings, positional correlation,
 * image ordering, stock semantics — so nothing downstream has to know the
 * wire shape exists.
 */
export function mapToProductView(
  product: TiendanubeProduct,
  // Colours arrive from the product custom fields resource, a SEPARATE call
  // (see `api/colourways.ts`), so they are passed in rather than read off the
  // product. `null` is the ordinary case: a garment that comes one way.
  colourway: Colourway | null = null,
): ProductView {
  assertPositionalCorrelation(product);

  const axes: OptionAxis[] = product.attributes.map((attribute, index) => ({
    index: index as OptionAxis["index"],
    label: pick(attribute),
    values: firstSeenUnique(
      product.variants.map((variant) => pick(variant.values[index]!)),
    ),
  }));

  const variants: VariantView[] = product.variants.map((variant) =>
    mapVariant(variant),
  );

  const images: ImageView[] = [...product.images]
    .sort((a, b) => a.position - b.position)
    .map((image) => ({ id: image.id, src: image.src, position: image.position }));

  const defaultVariant = variants.find((variant) => variant.inStock) ?? variants[0];
  if (!defaultVariant) {
    throw CatalogContractError.noVariants(product.id);
  }

  return {
    id: product.id,
    slug: pick(product.handle),
    title: pick(product.name),
    // Sanitised HERE, at the one place the wire description is ever read.
    // Doing it at the render site instead would make it a thing to remember
    // per component; doing it here makes it a thing the type system checks.
    descriptionHtml: toSafeHtml(pick(product.description)),
    images,
    axes,
    variants,
    defaultVariantId: defaultVariant.id,
    inStock: variants.some((variant) => variant.inStock),
    tags: product.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    colourway,
  };
}

function mapVariant(variant: TiendanubeVariant): VariantView {
  // Tiendanube's `price` is the original price; `promotional_price`, when
  // present, is the current discounted price. The struck-through price the
  // spec describes is always the ORIGINAL price, shown only when a
  // promotional price exists.
  const hasPromotion = variant.promotional_price !== null;

  return {
    id: variant.id,
    combination: variant.values.map((value) => pick(value)),
    price: parseMoney(hasPromotion ? variant.promotional_price! : variant.price),
    compareAt: hasPromotion ? parseMoney(variant.price) : null,
    inStock: !isSoldOut(variant),
  };
}

/**
 * Sold-out requires EXPLICIT stock management. `stock_management: false`
 * means the merchant does not track stock for this variant, so it is always
 * purchasable regardless of the `stock` count.
 */
export function isSoldOut(
  variant: Pick<TiendanubeVariant, "stock_management" | "stock">,
): boolean {
  return variant.stock_management && (variant.stock ?? 0) <= 0;
}

/**
 * The highest-risk assertion in this change: `attributes[i]` and
 * `variant.values[i]` correlate POSITIONALLY, with no linking key in the
 * wire format. If a variant's `values.length` does not equal the product's
 * `attributes.length`, indexing further would silently misalign selectors
 * — so this throws before any indexing happens.
 */
function assertPositionalCorrelation(product: TiendanubeProduct): void {
  const expected = product.attributes.length;
  for (const variant of product.variants) {
    if (variant.values.length !== expected) {
      throw CatalogContractError.positionalMismatch(
        product.id,
        expected,
        variant.values.length,
      );
    }
  }
}

function firstSeenUnique(values: string[]): string[] {
  return [...new Set(values)];
}
