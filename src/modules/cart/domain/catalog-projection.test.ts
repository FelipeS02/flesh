import { describe, expect, it } from "vitest";
import { makeProduct, makeVariant } from "../../../../test/fixtures/product-view";
import { indexCartCatalog, toCartCatalog } from "./catalog-projection";

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
          combination: ["M"],
          price: { amount: 2_700_000, currency: "ARS" },
          compareAt: { amount: 3_000_000, currency: "ARS" },
          inStock: true,
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
          combination: ["M"],
          price: { amount: 2_700_000, currency: "ARS" },
          inStock: true,
        },
      ],
    });
    expect(projected).not.toHaveProperty("descriptionHtml");
    expect(projected).not.toHaveProperty("axes");
    expect(projected).not.toHaveProperty("tags");
    expect(projected.variants[0]).not.toHaveProperty("compareAt");
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
});
