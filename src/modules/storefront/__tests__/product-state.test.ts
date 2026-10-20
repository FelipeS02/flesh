import { describe, expect, it } from "vitest";
import { cardBadge, productState } from "../product-state";

type Units = { stockManagement: boolean; stock: number | null };

const product = (tags: string[], inStock = true, variants: Units[] = []) => ({
  tags,
  inStock,
  variants: variants.map((units) => ({ ...units, inStock: units.stock !== 0 })),
});

const tracked = (stock: number): Units => ({ stockManagement: true, stock });
const untracked: Units = { stockManagement: false, stock: null };

const ars = (amount: number) => ({ amount, currency: "ARS" });
const priced = (amount: number, was: number | null = null) => ({
  price: ars(amount),
  compareAt: was === null ? null : ars(was),
});

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

describe("cardBadge", () => {
  it("badges the state when there is no markdown", () => {
    expect(cardBadge(product(["nuevo"]), priced(2_700_000))).toEqual({
      kind: "state",
      state: "new",
    });
  });

  it("badges the markdown when there is no state", () => {
    expect(cardBadge(product(["drop-1"]), priced(1_890_000, 2_700_000))).toEqual({
      kind: "discount",
      percent: 30,
    });
  });

  it("puts the markdown over being featured", () => {
    // A card competes in a grid, and a markdown is a fact about what you would
    // pay. `destacado` is the brand's opinion. The price fact wins the one
    // slot the artboard drew.
    expect(
      cardBadge(product(["destacado"]), priced(1_890_000, 2_700_000)),
    ).toEqual({ kind: "discount", percent: 30 });
  });

  it("puts being gone over everything, markdown included", () => {
    // A discount on a garment you cannot buy is not an offer.
    expect(
      cardBadge(product(["destacado"], false), priced(1_890_000, 2_700_000)),
    ).toEqual({ kind: "state", state: "soldOut" });
  });

  it("badges nothing on an ordinary product at full price", () => {
    expect(cardBadge(product(["drop-1"]), priced(2_700_000))).toBeNull();
  });

  it("survives a product with no variant to price", () => {
    expect(cardBadge(product(["nuevo"]), undefined)).toEqual({
      kind: "state",
      state: "new",
    });
  });

  it("badges the last units when the whole product is down to six", () => {
    // Summed across sizes: one size at 1 among well-stocked others is not the
    // garment running out.
    expect(cardBadge(product([], true, [tracked(1), tracked(5), tracked(0)]), priced(2_700_000))).toEqual({
      kind: "state",
      state: "lowStock",
    });
    expect(cardBadge(product([], true, [tracked(1), tracked(6)]), priced(2_700_000))).toBeNull();
  });

  it("never calls an untracked variant low, since its stock is unlimited", () => {
    expect(cardBadge(product([], true, [tracked(1), untracked]), priced(2_700_000))).toBeNull();
  });

  it("puts the last units over a markdown and over the merchant's tags", () => {
    // Scarcity is a fact that expires; the markdown still shows as the
    // struck-through price beside it.
    expect(
      cardBadge(product(["destacado"], true, [tracked(2)]), priced(1_890_000, 2_700_000)),
    ).toEqual({ kind: "state", state: "lowStock" });
  });

  it("still calls a product with nothing left sold out, not low", () => {
    expect(cardBadge(product([], false, [tracked(0)]), priced(2_700_000))).toEqual({
      kind: "state",
      state: "soldOut",
    });
  });
});
