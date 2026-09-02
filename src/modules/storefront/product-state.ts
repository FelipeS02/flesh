// The client entry — see the note in `./swatches.ts`; the PDP resolves a
// product's state on the server, but the type crosses into client props.
import type { ProductView } from "@/modules/catalog/client";

/**
 * The one thing a badge says about a garment.
 *
 * Deliberately a single value rather than a set of flags. A product can be new
 * AND featured AND sold out at once, and the artboards draw exactly one badge —
 * so the choice has to be made somewhere, and making it here means every
 * surface makes it the same way.
 */
export type ProductState = "soldOut" | "featured" | "new";

/**
 * Tag → state, in the order the badge is decided.
 *
 * `soldOut` is not in here because it is not a tag: it is stock, and stock
 * outranks anything the merchant wrote. Being new is not news about a garment
 * you cannot buy.
 *
 * `featured` beats `new` because in a first drop EVERYTHING is new, so the tag
 * that distinguishes one product from the others is the one worth the badge.
 */
const TAGGED_STATES: ReadonlyArray<readonly [tag: string, state: ProductState]> = [
  ["destacado", "featured"],
  ["nuevo", "new"],
];

/**
 * Which badge this product carries, or `null` for an ordinary one.
 *
 * Tags are trimmed and lower-cased before matching, and compared WHOLE — the
 * same rule `volume.ts` and `cuts.ts` already follow. Whole-tag matching is
 * what stops a future `nuevos-ingresos` from quietly badging every product in
 * it as new.
 */
export function productState(
  product: Pick<ProductView, "tags" | "inStock">,
): ProductState | null {
  if (!product.inStock) {
    return "soldOut";
  }

  const tags = new Set(product.tags.map((tag) => tag.trim().toLowerCase()));

  return TAGGED_STATES.find(([tag]) => tags.has(tag))?.[1] ?? null;
}
