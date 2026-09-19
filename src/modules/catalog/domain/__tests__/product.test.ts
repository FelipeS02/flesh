import { describe, expect, it } from "vitest";
import { purchaseLimit } from "../product";

/**
 * `purchaseLimit` is the one place the "how many can go in the cart" rule is
 * decided, so the reducer and every add-to-cart surface read the same number
 * the merchant actually set. It mirrors `isSoldOut` (`map.ts:97-100`): stock
 * management OFF means the merchant never tracked a count for this variant,
 * so there is no honest ceiling to enforce.
 */
describe("purchaseLimit", () => {
  it("returns null when the merchant does not track stock for the variant", () => {
    expect(purchaseLimit({ stockManagement: false, stock: 0 })).toBeNull();
  });

  it("returns null when untracked even if a stock count is present", () => {
    expect(purchaseLimit({ stockManagement: false, stock: 40 })).toBeNull();
  });

  it("returns 0 when stock is tracked and depleted", () => {
    expect(purchaseLimit({ stockManagement: true, stock: 0 })).toBe(0);
  });

  it("returns the tracked count otherwise", () => {
    expect(purchaseLimit({ stockManagement: true, stock: 5 })).toBe(5);
  });

  it("floors a tracked negative count at 0 rather than a negative limit", () => {
    expect(purchaseLimit({ stockManagement: true, stock: -3 })).toBe(0);
  });

  it("treats a tracked null stock as 0, not as unlimited", () => {
    expect(purchaseLimit({ stockManagement: true, stock: null })).toBe(0);
  });
});
