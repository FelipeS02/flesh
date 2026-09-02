import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { products } from "./fixtures/products";
import { ProductSchema } from "./schema";

// Minimal well-formed Tiendanube wire payload — verified contract shape:
// prices are strings, name/description/handle/attributes are {en,es,pt}
// objects, attributes correlate positionally with variant.values, stock is
// paired with stock_management, images carry position, tags is a CSV string.
const wellFormedProduct = {
  id: 101,
  name: { en: "Classic Tee", es: "Remera Classic", pt: "Camiseta Classic" },
  description: {
    en: "<p>A classic tee.</p>",
    es: "<p>Una remera clásica.</p>",
    pt: "<p>Uma camiseta clássica.</p>",
  },
  handle: { en: "classic-tee", es: "remera-classic", pt: "camiseta-classic" },
  attributes: [
    { en: "Size", es: "Talle", pt: "Tamanho" },
    { en: "Color", es: "Color", pt: "Cor" },
  ],
  variants: [
    {
      id: 201,
      product_id: 101,
      price: "25.00",
      promotional_price: "19.00",
      cost: "10.99",
      stock: 5,
      stock_management: true,
      weight: "2.00",
      values: [
        { en: "M", es: "M", pt: "M" },
        { en: "Black", es: "Negro", pt: "Preto" },
      ],
      sku: "TEE-M-BLK",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ],
  images: [
    { id: 301, product_id: 101, src: "https://example.com/a.jpg", position: 1 },
  ],
  categories: [
    {
      id: 401,
      name: { en: "Tops", es: "Remeras", pt: "Camisetas" },
      parent: null,
      subcategories: [],
    },
  ],
  tags: "nuevo,drop-1",
  published: true,
  visibility: "visible",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("ProductSchema", () => {
  it("parses a well-formed Tiendanube wire payload and preserves its data", () => {
    const result = ProductSchema.parse(wellFormedProduct);

    expect(result.name.es).toBe("Remera Classic");
    expect(result.variants[0]?.price).toBe("25.00");
    expect(result.tags).toBe("nuevo,drop-1");
  });

  it("throws ZodError when id is missing", () => {
    const malformed: Record<string, unknown> = { ...wellFormedProduct };
    delete malformed.id;

    expect(() => ProductSchema.parse(malformed)).toThrow(ZodError);
  });

  it("throws ZodError when price is the wrong type (number instead of string)", () => {
    const malformed = {
      ...wellFormedProduct,
      variants: [{ ...wellFormedProduct.variants[0], price: 25 }],
    };

    expect(() => ProductSchema.parse(malformed)).toThrow(ZodError);
  });

  it("parses every real Tiendanube mock fixture without throwing", () => {
    for (const product of products) {
      expect(() => ProductSchema.parse(product)).not.toThrow();
    }

    // Guards the loop against passing vacuously. It is deliberately NOT an
    // exact count: what makes this test true is that every fixture parses, and
    // pinning the total would make adding a review fixture look like a schema
    // regression.
    expect(products.length).toBeGreaterThan(0);
  });
});
