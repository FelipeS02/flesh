import { describe, expect, it } from "vitest";
import type { TiendanubeProduct } from "../api/types";
import { CatalogContractError } from "./product";
import { mapToProductView } from "./map";

// Minimal builder for a schema-valid Tiendanube wire product. Every field
// Zod requires is present with a plausible value; individual tests override
// only what they need to exercise. Kept local to this test file rather than
// reusing the api/fixtures — those already have committed edge cases and
// this suite needs precise, mismatch-shaped control over attributes/values.
function buildWireProduct(
  overrides: Partial<TiendanubeProduct> = {},
): TiendanubeProduct {
  return {
    id: 900,
    name: { en: "Test", es: "Prueba", pt: "Teste" },
    description: { en: "<p>desc</p>", es: "<p>desc</p>", pt: "<p>desc</p>" },
    handle: { en: "test", es: "prueba", pt: "teste" },
    attributes: [],
    variants: [],
    images: [],
    categories: [],
    tags: "a,b",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function buildWireVariant(
  overrides: Partial<TiendanubeProduct["variants"][number]> = {},
): TiendanubeProduct["variants"][number] {
  return {
    id: 1,
    product_id: 900,
    price: "10.00",
    promotional_price: null,
    cost: null,
    stock: 5,
    stock_management: true,
    weight: "1.00",
    values: [],
    sku: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("mapToProductView — positional correlation (highest-risk requirement)", () => {
  it("derives a 3-axis product's selections by index, never by name", () => {
    const wire = buildWireProduct({
      attributes: [
        { en: "Size", es: "Talle", pt: "Tamanho" },
        { en: "Color", es: "Color", pt: "Cor" },
        { en: "Fit", es: "Fit", pt: "Fit" },
      ],
      variants: [
        buildWireVariant({
          id: 1,
          values: [
            { en: "M", es: "M", pt: "M" },
            { en: "Black", es: "Negro", pt: "Preto" },
            { en: "Slim", es: "Slim", pt: "Slim" },
          ],
        }),
      ],
    });

    const result = mapToProductView(wire);

    expect(result.axes).toEqual([
      { index: 0, label: "Talle", values: ["M"] },
      { index: 1, label: "Color", values: ["Negro"] },
      { index: 2, label: "Fit", values: ["Slim"] },
    ]);
    expect(result.variants[0]?.combination).toEqual(["M", "Negro", "Slim"]);
  });

  it("throws CatalogContractError naming the product id and expected/actual lengths on a positional mismatch", () => {
    // Schema-valid (Zod only checks each `values` entry is a well-formed
    // LangText, not that its length matches attributes.length) but
    // mapper-invariant-invalid: 3 attributes, only 2 variant values.
    const wire = buildWireProduct({
      id: 777,
      attributes: [
        { en: "Size", es: "Talle", pt: "Tamanho" },
        { en: "Color", es: "Color", pt: "Cor" },
        { en: "Fit", es: "Fit", pt: "Fit" },
      ],
      variants: [
        buildWireVariant({
          values: [
            { en: "M", es: "M", pt: "M" },
            { en: "Black", es: "Negro", pt: "Preto" },
          ],
        }),
      ],
    });

    expect(() => mapToProductView(wire)).toThrow(CatalogContractError);
    try {
      mapToProductView(wire);
      throw new Error("expected mapToProductView to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogContractError);
      const contractError = error as CatalogContractError;
      expect(contractError.productId).toBe(777);
      expect(contractError.message).toContain("777");
      expect(contractError.message).toContain("attributes.length (3)");
      expect(contractError.message).toContain("values.length (2)");
    }
  });

  it("reports a variant-less product as its own violation, not as a fabricated attribute mismatch", () => {
    // A product with no variants is unsellable — there is nothing to price,
    // nothing to add to a cart. It is a real contract violation, but a
    // DIFFERENT one from a positional mismatch, and its message must say so
    // rather than inventing attribute/value lengths that were never read.
    const wire = buildWireProduct({ id: 555, attributes: [], variants: [] });

    try {
      mapToProductView(wire);
      throw new Error("expected mapToProductView to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogContractError);
      const contractError = error as CatalogContractError;
      expect(contractError.productId).toBe(555);
      expect(contractError.message).toContain("no variants");
      expect(contractError.message).not.toContain("attributes.length");
    }
  });

  it("maps a zero-attribute product cleanly: axes=[] and the single variant is still fully mapped", () => {
    const wire = buildWireProduct({
      attributes: [],
      variants: [buildWireVariant({ id: 42, values: [] })],
    });

    const result = mapToProductView(wire);

    expect(result.axes).toEqual([]);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.combination).toEqual([]);
  });
});

describe("mapToProductView — images", () => {
  it("sorts images by position ascending, regardless of wire order", () => {
    const wire = buildWireProduct({
      variants: [buildWireVariant({ values: [] })],
      images: [
        { id: 1, product_id: 900, src: "c.jpg", position: 3 },
        { id: 2, product_id: 900, src: "a.jpg", position: 1 },
        { id: 3, product_id: 900, src: "b.jpg", position: 2 },
      ],
    });

    const result = mapToProductView(wire);

    expect(result.images.map((image) => image.position)).toEqual([1, 2, 3]);
    expect(result.images.map((image) => image.src)).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
    ]);
  });
});

describe("mapToProductView — sold-out requires explicit stock management", () => {
  it("is sold out when stock_management is true and stock <= 0", () => {
    const wire = buildWireProduct({
      variants: [
        buildWireVariant({ stock_management: true, stock: 0 }),
      ],
    });

    const result = mapToProductView(wire);

    expect(result.variants[0]?.inStock).toBe(false);
  });

  it("is always purchasable when stock_management is false, regardless of stock", () => {
    const wire = buildWireProduct({
      variants: [
        buildWireVariant({ stock_management: false, stock: 0 }),
      ],
    });

    const result = mapToProductView(wire);

    expect(result.variants[0]?.inStock).toBe(true);
  });
});
