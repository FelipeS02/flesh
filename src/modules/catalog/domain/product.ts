import type { Money } from "../lib/money";
import type { SafeHtml } from "../lib/sanitize";

export type { Money, SafeHtml };

// The domain view — deliberately contains NO language-keyed ({en,es,pt})
// objects and NO price strings. That is the whole point of the mapper
// (`./map.ts`): a component holding one of these types cannot accidentally
// render an unresolved locale object or do arithmetic on a price string,
// because the shape itself does not allow it (see design decision 1).

export type ImageView = {
  id: number;
  src: string;
  position: number;
};

// Mirrors the wire's own positional model (at most 3 attributes per
// product) rather than inventing a synthetic linking key — see design
// decision 2.
export type OptionAxis = {
  index: 0 | 1 | 2;
  label: string;
  values: string[];
};

export type VariantView = {
  id: number;
  // Parallel to `ProductView.axes` — `combination[i]` is this variant's
  // selected value for `axes[i]`, positional, never name-keyed.
  combination: string[];
  price: Money;
  compareAt: Money | null;
  inStock: boolean;
};

export type ProductView = {
  id: number;
  slug: string;
  title: string;
  // Locale-resolved AND sanitised. The brand is the load-bearing part: only
  // `catalog/lib/sanitize.ts` can mint a `SafeHtml`, so the single call site
  // of `dangerouslySetInnerHTML` cannot be handed raw merchant markup
  // without failing to compile.
  descriptionHtml: SafeHtml;
  images: ImageView[];
  axes: OptionAxis[];
  variants: VariantView[];
  defaultVariantId: number;
  inStock: boolean;
  tags: string[];
};

/**
 * Thrown when a wire product violates an invariant the mapper depends on.
 * Fixtures are ours; silence here is the actual risk (see design decision
 * 2's failure-policy table), so the mapper fails loudly rather than
 * emitting a partial or misaligned product.
 *
 * Construct it through the named factories below, never with a raw message.
 * Each factory owns one violation and describes only what it actually
 * observed — a diagnosis invented to fit a constructor sends the next
 * reader hunting for a problem that was never there.
 */
export class CatalogContractError extends Error {
  private constructor(
    public readonly productId: number,
    detail: string,
  ) {
    super(`Product ${productId}: ${detail}`);
    this.name = "CatalogContractError";
  }

  /**
   * `attributes[i]` and `variant.values[i]` correlate POSITIONALLY, with no
   * linking key in the wire format. Unequal lengths mean indexing further
   * would silently misalign selectors.
   */
  static positionalMismatch(
    productId: number,
    expectedLength: number,
    actualLength: number,
  ): CatalogContractError {
    return new CatalogContractError(
      productId,
      `variant values.length (${actualLength}) does not match product ` +
        `attributes.length (${expectedLength}). Positional attribute/value ` +
        `correlation is broken — refusing to silently misalign selectors.`,
    );
  }

  /**
   * A product with no variants has nothing to price and nothing to add to a
   * cart, so there is no honest `defaultVariantId` to publish.
   */
  static noVariants(productId: number): CatalogContractError {
    return new CatalogContractError(
      productId,
      `has no variants, so it has no price and no default selection — ` +
        `refusing to emit an unsellable product.`,
    );
  }
}
