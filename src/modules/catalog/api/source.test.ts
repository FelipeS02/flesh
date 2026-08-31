import { describe, expect, it } from "vitest";
import { getProductByHandle, getProducts } from "./source";

describe("getProducts", () => {
  it("returns only products with visibility 'visible', excluding unlisted ones", () => {
    const result = getProducts();

    expect(result.length).toBe(2);
    expect(result.every((product) => product.visibility === "visible")).toBe(
      true,
    );
    expect(
      result.some((product) => product.handle.es === "gorra-limitada"),
    ).toBe(false);
  });

  it("includes a known visible product by its Spanish handle", () => {
    const result = getProducts();

    expect(result.some((product) => product.handle.es === "remera-classic")).toBe(
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
