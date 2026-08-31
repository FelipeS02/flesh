import { describe, expect, it } from "vitest";
import type { ProductView, VariantView } from "./product";
import { deriveAxisStates, resolveVariant } from "./selectors";

const PRICE = { amount: 2500, currency: "ARS" } as const;

function buildVariant(
  id: number,
  combination: string[],
  inStock: boolean,
): VariantView {
  return { id, combination, price: PRICE, compareAt: null, inStock };
}

function buildProductView(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 900,
    slug: "prueba",
    title: "Prueba",
    descriptionHtml: "<p>desc</p>",
    images: [],
    axes: [],
    variants: [],
    defaultVariantId: 1,
    inStock: true,
    tags: [],
    ...overrides,
  };
}

// Two axes, one deliberately incomplete matrix:
//   Talle x Color -> M/Negro (in stock), M/Rojo (sold out), L/Negro (in stock).
// L/Rojo has NO variant at all, which is what separates `nonexistent` from
// `soldOut` — the distinction the reference PDP renders as "— agotado" versus
// simply not being an offered combination.
function buildTwoAxisProduct(): ProductView {
  return buildProductView({
    axes: [
      { index: 0, label: "Talle", values: ["M", "L"] },
      { index: 1, label: "Color", values: ["Negro", "Rojo"] },
    ],
    variants: [
      buildVariant(1, ["M", "Negro"], true),
      buildVariant(2, ["M", "Rojo"], false),
      buildVariant(3, ["L", "Negro"], true),
    ],
  });
}

describe("deriveAxisStates", () => {
  it("marks a value available when an in-stock variant matches the other axes", () => {
    const product = buildTwoAxisProduct();

    expect(deriveAxisStates(product, ["M", null], 1)).toEqual([
      { value: "Negro", state: "available" },
      { value: "Rojo", state: "soldOut" },
    ]);
  });

  it("marks a value nonexistent when no variant offers that combination at all", () => {
    const product = buildTwoAxisProduct();

    expect(deriveAxisStates(product, ["L", null], 1)).toEqual([
      { value: "Negro", state: "available" },
      { value: "Rojo", state: "nonexistent" },
    ]);
  });

  it("constrains on the other axes only, never on the axis being derived", () => {
    // Selection already holds a value for axis 0. Deriving axis 0 must IGNORE
    // it, otherwise every unselected value would collapse to `nonexistent`
    // and the selector would become impossible to change once set.
    const product = buildTwoAxisProduct();

    expect(deriveAxisStates(product, ["M", "Negro"], 0)).toEqual([
      { value: "M", state: "available" },
      { value: "L", state: "available" },
    ]);
  });

  it("treats a null axis as unconstrained, not as a value to match", () => {
    const product = buildTwoAxisProduct();

    expect(deriveAxisStates(product, [null, null], 1)).toEqual([
      { value: "Negro", state: "available" },
      // Rojo exists only as the sold-out M/Rojo variant.
      { value: "Rojo", state: "soldOut" },
    ]);
  });

  it("returns an empty list for a zero-attribute product", () => {
    const product = buildProductView({
      axes: [],
      variants: [buildVariant(42, [], true)],
    });

    expect(deriveAxisStates(product, [], 0)).toEqual([]);
  });
});

describe("resolveVariant", () => {
  it("returns the exact-match variant when every axis is selected", () => {
    const product = buildTwoAxisProduct();

    expect(resolveVariant(product, ["M", "Rojo"])?.id).toBe(2);
  });

  it("returns null while any axis is still null", () => {
    const product = buildTwoAxisProduct();

    expect(resolveVariant(product, ["M", null])).toBeNull();
    expect(resolveVariant(product, [null, "Negro"])).toBeNull();
  });

  it("returns null for a fully-selected combination no variant offers", () => {
    const product = buildTwoAxisProduct();

    expect(resolveVariant(product, ["L", "Rojo"])).toBeNull();
  });

  it("returns null for a selection that does not cover every axis", () => {
    // No entry is null here, so the null guard does not catch it — but a
    // one-entry selection over a two-axis product is still not a complete
    // choice, and matching on the entries present would silently resolve
    // M/Negro and price a variant the shopper never finished choosing.
    const product = buildTwoAxisProduct();

    expect(resolveVariant(product, ["M"])).toBeNull();
  });

  it("resolves the single variant of a zero-attribute product from an empty selection", () => {
    // A=0 must still resolve, or price and stock have nothing to read from.
    const product = buildProductView({
      axes: [],
      variants: [buildVariant(42, [], true)],
    });

    expect(resolveVariant(product, [])?.id).toBe(42);
  });
});
