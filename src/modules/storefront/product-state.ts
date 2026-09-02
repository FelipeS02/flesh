// The client entry — see the note in `./swatches.ts`; the PDP resolves a
// product's state on the server, but the type crosses into client props.
import type { ProductView, VariantView } from "@/modules/catalog/client";
import { discountPercent } from "./pricing";

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

/** What a catalogue card puts in its ONE badge slot over the photo. */
export type CardBadge =
  | { kind: "state"; state: ProductState }
  | { kind: "discount"; percent: number };

/**
 * The single badge a catalogue card shows.
 *
 * The card has one slot — the artboard never draws two — so unlike the PDP,
 * where the state sits over the photo and the markdown sits against the price,
 * here the two compete and the order has to be decided:
 *
 * 1. **Gone beats everything.** A discount on a garment you cannot buy is not
 *    an offer.
 * 2. **A markdown beats being featured.** A card competes in a grid, and how
 *    much less you would pay is a fact about the price; `destacado` is the
 *    brand's opinion about the garment.
 * 3. Otherwise, whatever state there is.
 *
 * The PDP does not need this function: it has room to show both, in the two
 * different places each one belongs.
 */
export function cardBadge(
  product: Pick<ProductView, "tags" | "inStock">,
  variant: Pick<VariantView, "price" | "compareAt"> | undefined,
): CardBadge | null {
  const state = productState(product);

  if (state === "soldOut") {
    return { kind: "state", state };
  }

  const percent = variant ? discountPercent(variant.price, variant.compareAt) : null;

  if (percent !== null) {
    return { kind: "discount", percent };
  }

  return state ? { kind: "state", state } : null;
}
