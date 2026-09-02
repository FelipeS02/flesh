import { describe, expect, it } from "vitest";
import { productState } from "./product-state";

const product = (tags: string[], inStock = true) => ({ tags, inStock });

describe("productState", () => {
  it("reads the merchant's tags", () => {
    expect(productState(product(["drop-1", "nuevo"]))).toBe("new");
    expect(productState(product(["drop-1", "destacado"]))).toBe("featured");
  });

  it("badges a sold-out product as sold out, whatever else it is tagged", () => {
    // Being new is not news about a garment you cannot buy.
    expect(productState(product(["nuevo", "destacado"], false))).toBe("soldOut");
  });

  it("prefers destacado over nuevo, because one badge fits", () => {
    // Everything in a first drop is new; being picked out is the rarer claim,
    // and it is the one the brand chose to make.
    expect(productState(product(["nuevo", "destacado"]))).toBe("featured");
  });

  it("says nothing about an ordinary in-stock product", () => {
    expect(productState(product(["drop-1", "corte-remera-oversize"]))).toBeNull();
  });

  it("reads tags the way the rest of the catalogue does", () => {
    // `volume.ts` and `cuts.ts` both trim and lower-case before matching; a
    // third dialect here would make the same tag work in two places and not a
    // third.
    expect(productState(product([" NUEVO "]))).toBe("new");
  });

  it("is not fooled by a tag that merely contains one", () => {
    expect(productState(product(["nuevos-ingresos"]))).toBeNull();
  });
});
