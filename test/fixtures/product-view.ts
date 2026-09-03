import type { ProductView, SafeHtml, VariantView } from "@/modules/catalog";

/**
 * Domain-shaped test data, built directly rather than mapped from a wire
 * fixture: consumers of `ProductView` (the storefront, the PDP) must be
 * testable without dragging the Tiendanube wire contract and the mapper into
 * their tests. `api/fixtures/products.ts` stays the wire-side fixture.
 */
export function makeVariant(overrides: Partial<VariantView> = {}): VariantView {
  return {
    id: 201,
    combination: [],
    price: { amount: 2_700_000, currency: "ARS" },
    compareAt: null,
    inStock: true,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<ProductView> = {}): ProductView {
  const variants = overrides.variants ?? [makeVariant()];

  return {
    id: 101,
    slug: "musculosa-demon-wash-black",
    title: "Musculosa Demon Wash Black",
    descriptionHtml: "<p>Base negra, arte crudo.</p>" as SafeHtml,
    images: [{ id: 301, src: "/products/1.png", position: 1 }],
    axes: [],
    defaultVariantId: variants[0]!.id,
    inStock: variants.some((variant) => variant.inStock),
    tags: ["drop-1"],
    colourway: null,
    ...overrides,
    variants,
  };
}
