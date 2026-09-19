import { describe, expect, it, vi } from "vitest";
import { makeProduct, makeVariant } from "../../../../../test/fixtures/product-view";
import { indexCartCatalog, toCartCatalog } from "../catalog-projection";

// Mocked by string path, not imported: `@/modules/catalog/api/source` is the
// catalog module's private wire layer (enforced by the no-restricted-imports
// ESLint rule), so this suite reaches it only to stand in for the live
// Tiendanube-backed implementation, never to import from it directly.
const unlistedColourwayVariantId = 214;
vi.mock("@/modules/catalog/api/source", () => ({
  getPurchasableProducts: async () => [
    { id: 108, slug: "cross-tee-noir", title: "Cross Tee Noir", images: [], variants: [{ id: 212, combination: [], price: { amount: 3_300_000, currency: "ARS" }, compareAt: null, inStock: true, stockManagement: true, stock: 4 }] },
    // The secondary colourway: `unlisted`, reachable and fully purchasable
    // from its own PDP, but deliberately absent from `getProducts()`
    // (`listed`, visible-only) — see `tiendanube.ts`'s snapshot split.
    { id: 109, slug: "cross-tee-bone", title: "Cross Tee Bone", images: [], variants: [{ id: unlistedColourwayVariantId, combination: [], price: { amount: 3_300_000, currency: "ARS" }, compareAt: null, inStock: false, stockManagement: true, stock: 0 }] },
  ],
}));
const { getPurchasableProducts } = await import("@/modules/catalog");

describe("toCartCatalog", () => {
  it("projects only the fields the cart needs, dropping descriptionHtml/axes/compareAt/tags", () => {
    const product = makeProduct({
      id: 101,
      slug: "musculosa-demon-wash-black",
      title: "Musculosa Demon Wash Black",
      images: [{ id: 301, src: "/products/1.png", position: 1 }],
      axes: [{ index: 0, label: "Talle", values: ["M"] }],
      tags: ["drop-1"],
      variants: [
        makeVariant({
          id: 201,
          sku: "TEE-M",
          combination: ["M"],
          price: { amount: 2_700_000, currency: "ARS" },
          compareAt: { amount: 3_000_000, currency: "ARS" },
          inStock: true,
          stockManagement: true,
          stock: 3,
        }),
      ],
    });

    const [projected] = toCartCatalog([product]);

    expect(projected).toEqual({
      productId: 101,
      slug: "musculosa-demon-wash-black",
      title: "Musculosa Demon Wash Black",
      image: "/products/1.png",
      variants: [
        {
          id: 201,
          sku: "TEE-M",
          combination: ["M"],
          price: { amount: 2_700_000, currency: "ARS" },
          compareAt: { amount: 3_000_000, currency: "ARS" },
          inStock: true,
          stockManagement: true,
          stock: 3,
        },
      ],
    });
    expect(projected).not.toHaveProperty("descriptionHtml");
    expect(projected).not.toHaveProperty("axes");
    expect(projected).not.toHaveProperty("tags");
    expect(projected.variants[0]).toHaveProperty("compareAt");
    expect(projected.variants[0]).toHaveProperty("sku", "TEE-M");
  });

  it("projects a null image for a product with no images", () => {
    const product = makeProduct({ images: [] });

    const [projected] = toCartCatalog([product]);

    expect(projected?.image).toBeNull();
  });

  it("projects every product in the array, in order", () => {
    const products = [
      makeProduct({ id: 101, variants: [makeVariant({ id: 201 })] }),
      makeProduct({ id: 102, variants: [makeVariant({ id: 202 })] }),
    ];

    const projected = toCartCatalog(products);

    expect(projected.map((p) => p.productId)).toEqual([101, 102]);
  });
});

describe("indexCartCatalog", () => {
  it("indexes every variant by its id, pairing it with its own product", () => {
    const products = [
      makeProduct({
        id: 101,
        title: "Musculosa Demon Wash Black",
        variants: [makeVariant({ id: 201 }), makeVariant({ id: 202 })],
      }),
      makeProduct({ id: 102, title: "Otro producto", variants: [makeVariant({ id: 301 })] }),
    ];
    const catalog = toCartCatalog(products);

    const index = indexCartCatalog(catalog);

    expect(index.get(201)?.product.productId).toBe(101);
    expect(index.get(202)?.product.productId).toBe(101);
    expect(index.get(301)?.product.title).toBe("Otro producto");
  });

  it("has no entry for a variant id that does not exist", () => {
    const catalog = toCartCatalog([makeProduct({ variants: [makeVariant({ id: 201 })] })]);

    const index = indexCartCatalog(catalog);

    expect(index.has(999)).toBe(false);
  });

  it("resolves an unlisted colourway's variant, the exact case the cart used to drop (AddedToast rendered empty, reconcile dropped the line on reload)", async () => {
    // Regression for the bug where `layout.tsx` built the cart catalog from
    // `getProducts()` (`listed`, visible-only) instead of the purchasable
    // set. An unlisted colourway is fully purchasable from its own PDP, but
    // its variant was missing from the index — `AddedToast` got `undefined`
    // from `index.get(variantId)` and rendered an empty box, and `reconcile`
    // treated the line as an `unknown-variant` and dropped it on reload.
    const catalog = toCartCatalog(await getPurchasableProducts());
    const index = indexCartCatalog(catalog);

    expect(index.has(unlistedColourwayVariantId)).toBe(true);
  });
});
