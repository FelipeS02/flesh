import { describe, expect, it } from "vitest";
import type { CartLine, CartNotice } from "./line";
import { cartReducer, initialCartState } from "./reducer";

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

/**
 * The state every action below the first block starts from. Written as a
 * helper rather than inline because `ready` is now a STATE, not a list — the
 * reducer no longer takes `CartLine[]`, and the shape change is the point of
 * the hydration union rather than noise to hide.
 */
function ready(lines: CartLine[], notices: CartNotice[] = []) {
  return { status: "ready", lines, notices } as const;
}

const REMOVED: CartNotice = {
  kind: "removed",
  reason: "out-of-stock",
  variantId: 201,
  item: "Remera Classic / M, Negro",
};

const REPRICED: CartNotice = {
  kind: "repriced",
  variantId: 202,
  item: "Remera Classic / L, Negro",
  from: { amount: 2_700_000, currency: "ARS" },
  to: { amount: 3_100_000, currency: "ARS" },
};

describe("cartReducer", () => {
  it("adds a new variant at quantity 1", () => {
    const result = cartReducer(ready([]), {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    expect(result).toEqual(ready([buildLine({ quantity: 1 })]));
  });

  it("merges into the existing line instead of appending a second one", () => {
    const existing = ready([buildLine({ quantity: 1 })]);

    const result = cartReducer(existing, {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    expect(result).toEqual(ready([buildLine({ quantity: 2 })]));
  });

  it("increments the quantity of the matching line", () => {
    const existing = ready([buildLine({ quantity: 1 })]);

    const result = cartReducer(existing, { type: "increment", variantId: 201 });

    expect(result).toEqual(ready([buildLine({ quantity: 2 })]));
  });

  it("removes the line when decrementing below 1", () => {
    const existing = ready([buildLine({ quantity: 1 })]);

    const result = cartReducer(existing, { type: "decrement", variantId: 201 });

    expect(result).toEqual(ready([]));
  });

  it("decrements without removing while quantity stays above 0", () => {
    const existing = ready([buildLine({ quantity: 2 })]);

    const result = cartReducer(existing, { type: "decrement", variantId: 201 });

    expect(result).toEqual(ready([buildLine({ quantity: 1 })]));
  });

  it("removes a line explicitly via remove, regardless of quantity", () => {
    const existing = ready([buildLine({ quantity: 5 })]);

    const result = cartReducer(existing, { type: "remove", variantId: 201 });

    expect(result).toEqual(ready([]));
  });

  it("empties every line via clear", () => {
    const existing = ready([buildLine({ variantId: 201 }), buildLine({ variantId: 202 })]);

    const result = cartReducer(existing, { type: "clear" });

    expect(result).toEqual(ready([]));
  });

  it("never holds two lines for the same variant after repeated adds", () => {
    const add = { type: "add", productId: 101, variantId: 201, price: PRICE } as const;
    let state = cartReducer(ready([]), add);
    state = cartReducer(state, add);
    state = cartReducer(state, add);

    expect(state).toEqual(ready([buildLine({ quantity: 3 })]));
  });

  // Notices record what already happened to the shopper's cart; emptying the
  // cart does not un-happen it. Only an explicit dismissal removes one.
  it("keeps pending notices when the lines are cleared", () => {
    const existing = ready([buildLine()], [REMOVED]);

    const result = cartReducer(existing, { type: "clear" });

    expect(result).toEqual(ready([], [REMOVED]));
  });
});

/**
 * The hydration union, per the cart-state decision: while the cart is
 * hydrating it has NO readable `lines`, so no surface can assert a fact about
 * a cart nobody has read yet. A badge that shows 0 and jumps to 3 is a glitch;
 * "Tu carrito esta vacio" over three stored garments is a lie. The tests below
 * are about that guarantee, and about the one thing that must survive it: a
 * click that lands before storage was read.
 */
describe("hydration", () => {
  it("starts hydrating, with no lines to read", () => {
    expect(initialCartState.status).toBe("hydrating");
    expect(initialCartState).not.toHaveProperty("lines");
    expect(initialCartState).not.toHaveProperty("notices");
  });

  it("stays hydrating when a shopper adds before storage has been read", () => {
    const result = cartReducer(initialCartState, {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    expect(result.status).toBe("hydrating");
    expect(result).not.toHaveProperty("lines");
  });

  it("becomes ready on rehydrate, carrying the reconciled lines and notices", () => {
    const stored = buildLine({ variantId: 201, quantity: 2 });

    const result = cartReducer(initialCartState, {
      type: "rehydrate",
      lines: [stored],
      notices: [REPRICED],
    });

    expect(result).toEqual(ready([stored], [REPRICED]));
  });

  it("becomes ready on rehydrate even when storage held nothing", () => {
    const result = cartReducer(initialCartState, {
      type: "rehydrate",
      lines: [],
      notices: [],
    });

    // Ready-and-empty, NOT still hydrating: an absent record is an answer.
    // Without this the provider would never leave `hydrating` and every
    // surface would wait forever for a cart that was never there.
    expect(result).toEqual(ready([]));
  });

  // The mid-flight add race (design D4, ordering hazard 3). The click landed
  // between mount and the read effect; replacing rather than merging would
  // silently throw it away.
  it("sums a mid-flight add into the stored line for the same variant", () => {
    const clicked = cartReducer(initialCartState, {
      type: "add",
      productId: 101,
      variantId: 201,
      price: PRICE,
    });

    const result = cartReducer(clicked, {
      type: "rehydrate",
      lines: [buildLine({ variantId: 201, quantity: 2 })],
      notices: [],
    });

    expect(result).toEqual(ready([buildLine({ variantId: 201, quantity: 3 })]));
  });

  it("keeps a mid-flight add for a variant storage never held", () => {
    const clicked = cartReducer(initialCartState, {
      type: "add",
      productId: 101,
      variantId: 202,
      price: PRICE,
    });

    const result = cartReducer(clicked, {
      type: "rehydrate",
      lines: [buildLine({ variantId: 201, quantity: 1 })],
      notices: [],
    });

    expect(result).toEqual(
      ready([buildLine({ variantId: 201 }), buildLine({ variantId: 202 })]),
    );
  });
});

describe("dismissNotice", () => {
  it("removes exactly the notice for that variant", () => {
    const existing = ready([buildLine()], [REMOVED, REPRICED]);

    const result = cartReducer(existing, { type: "dismissNotice", variantId: 201 });

    expect(result).toEqual(ready([buildLine()], [REPRICED]));
  });

  it("leaves every notice alone when no variant matches", () => {
    const existing = ready([], [REMOVED, REPRICED]);

    const result = cartReducer(existing, { type: "dismissNotice", variantId: 999 });

    expect(result).toEqual(ready([], [REMOVED, REPRICED]));
  });

  it("is a no-op while hydrating, where no notice has been read yet", () => {
    const result = cartReducer(initialCartState, { type: "dismissNotice", variantId: 201 });

    expect(result).toEqual(initialCartState);
  });
});
