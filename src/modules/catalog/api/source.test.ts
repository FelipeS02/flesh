import { describe, expect, it } from "vitest";
import { products } from "./fixtures/products";
import { getProductByHandle, getProducts } from "./source";

// These assertions moved from wire fields to domain fields when the port
// started returning `ProductView` (task 4b.14): `handle.es` became `slug`,
// and `visibility` is no longer observable from outside at all — it is a
// wire-only concern, so the filter is now asserted by which products come
// back, not by reading a field off them.

describe("getProducts", () => {
  it("returns only products with visibility 'visible', excluding unlisted ones", () => {
    const result = getProducts();

    // The count is DERIVED from the fixtures, not written down: the review
    // catalogue exists to grow a product per state, and a hardcoded number
    // turns every one of those into a failure that says nothing about the
    // filter this test is here to check.
    const visible = products.filter(
      (product) => product.visibility === "visible",
    ).length;

    expect(result.length).toBe(visible);
    expect(result.some((product) => product.slug === "gorra-limitada")).toBe(
      false,
    );
  });

  it("includes a known visible product by its Spanish slug", () => {
    const result = getProducts();

    expect(result.some((product) => product.slug === "remera-classic")).toBe(
      true,
    );
  });
});

describe("getProductByHandle", () => {
  it("returns the matching product for a known slug", () => {
    const result = getProductByHandle("remera-classic");

    expect(result).not.toBeNull();
    expect(result?.id).toBe(101);
  });

  it("returns null for an unknown slug", () => {
    const result = getProductByHandle("does-not-exist");

    expect(result).toBeNull();
  });

  it("returns null for a traversal-shaped slug, never touching fs/path", () => {
    const result = getProductByHandle("../../etc/passwd");

    expect(result).toBeNull();
  });
});

describe("garment content joins", () => {
  it("joins independent Fit and chart content only to a current product", () => {
    const product = getProductByHandle("remera-classic");
    expect(product?.fit).toEqual({ type: "top", position: 65 });
    expect(product?.sizeChart?.map((row) => row.size)).toEqual(["S", "M"]);
  });

  it("does not create content for the stale custom-field owner", () => {
    expect(getProducts().some((product) => product.id === 999)).toBe(false);
  });
});

it("has no legacy cut-tag dependency in its fixture-backed product views", () => {
  expect(getProducts().every((product) => product.tags.every((tag) => !tag.startsWith("corte-")))).toBe(true);
});
