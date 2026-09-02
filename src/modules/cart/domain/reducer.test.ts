import { describe, expect, it } from "vitest";
import type { CartLine } from "./line";
import { cartReducer } from "./reducer";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;

function buildLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 101,
    variantId: 201,
    quantity: 1,
    price: PRICE,
    ...overrides,
  };
}

describe("cartReducer", () => {
  it("adds a new variant at quantity 1", () => {
    const result = cartReducer([], {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    expect(result).toEqual([buildLine({ quantity: 1 })]);
  });

  it("merges into the existing line instead of appending a second one", () => {
    const existing = [buildLine({ quantity: 1 })];

    const result = cartReducer(existing, {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(2);
  });

  it("increments the quantity of the matching line", () => {
    const existing = [buildLine({ quantity: 1 })];

    const result = cartReducer(existing, { type: "increment", variantId: 201 });

    expect(result).toEqual([buildLine({ quantity: 2 })]);
  });

  it("removes the line when decrementing below 1", () => {
    const existing = [buildLine({ quantity: 1 })];

    const result = cartReducer(existing, { type: "decrement", variantId: 201 });

    expect(result).toEqual([]);
  });

  it("decrements without removing while quantity stays above 0", () => {
    const existing = [buildLine({ quantity: 2 })];

    const result = cartReducer(existing, { type: "decrement", variantId: 201 });

    expect(result).toEqual([buildLine({ quantity: 1 })]);
  });

  it("removes a line explicitly via remove, regardless of quantity", () => {
    const existing = [buildLine({ quantity: 5 })];

    const result = cartReducer(existing, { type: "remove", variantId: 201 });

    expect(result).toEqual([]);
  });

  it("empties every line via clear", () => {
    const existing = [buildLine({ variantId: 201 }), buildLine({ variantId: 202 })];

    const result = cartReducer(existing, { type: "clear" });

    expect(result).toEqual([]);
  });

  it("never holds two lines for the same variant after repeated adds", () => {
    let state = cartReducer([], { type: "add", productId: 101, variantId: 201, price: PRICE });
    state = cartReducer(state, { type: "add", productId: 101, variantId: 201, price: PRICE });
    state = cartReducer(state, { type: "add", productId: 101, variantId: 201, price: PRICE });

    expect(state).toHaveLength(1);
    expect(state[0]?.quantity).toBe(3);
  });
});
