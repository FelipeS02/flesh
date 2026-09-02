import { describe, expect, it } from "vitest";
import { balancedColumns, MAX_COLUMNS } from "./columns";

describe("balancedColumns", () => {
  it("fills a single row while the drop is small enough for one", () => {
    expect(balancedColumns(1)).toBe(1);
    expect(balancedColumns(2)).toBe(2);
    expect(balancedColumns(3)).toBe(3);
    expect(balancedColumns(4)).toBe(4);
  });

  it("splits six evenly rather than leaving two cards under four", () => {
    // The case that prompted this: at four columns six products render 4 + 2,
    // and the short second row reads as a layout that ran out rather than one
    // that was chosen.
    expect(balancedColumns(6)).toBe(3);
  });

  it("never adds a row it does not need", () => {
    // Five fits in two rows at three or four columns, and three is the
    // squarer of the two — but three rows of two would be squarer still, and
    // that is NOT the answer. Rows come first.
    expect(balancedColumns(5)).toBe(3);
    expect(balancedColumns(7)).toBe(4);
    expect(balancedColumns(8)).toBe(4);
  });

  it("keeps every row equal when the count allows it", () => {
    expect(balancedColumns(9)).toBe(3);
    expect(balancedColumns(12)).toBe(4);
  });

  it("survives an empty catalogue without dividing by zero", () => {
    expect(balancedColumns(0)).toBe(1);
  });

  it("never exceeds the row the artboard's frame can hold", () => {
    for (let count = 1; count <= 40; count++) {
      expect(balancedColumns(count)).toBeLessThanOrEqual(MAX_COLUMNS);
      expect(balancedColumns(count)).toBeGreaterThanOrEqual(1);
    }
  });

  it("takes the ceiling as an argument, for a narrower container", () => {
    expect(balancedColumns(6, 2)).toBe(2);
    expect(balancedColumns(6, 3)).toBe(3);
  });
});
