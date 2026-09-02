import { describe, expect, it } from "vitest";
import { makeProduct } from "../../../test/fixtures/product-view";
import { groupByVolume } from "./volume";

describe("groupByVolume", () => {
  it("collects every product of one drop into a single titled volume", () => {
    const groups = groupByVolume([
      makeProduct({ id: 101, tags: ["nuevo", "drop-1"] }),
      makeProduct({ id: 102, tags: ["drop-1"] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("drop-1");
    expect(groups[0]?.title).toBe("Volumen I");
    expect(groups[0]?.products.map((product) => product.id)).toEqual([101, 102]);
  });

  it("orders volumes by drop number, not by the order products arrive in", () => {
    const groups = groupByVolume([
      makeProduct({ id: 201, tags: ["drop-2"] }),
      makeProduct({ id: 101, tags: ["drop-1"] }),
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      "Volumen I",
      "Volumen II",
    ]);
  });

  it("keeps products with no drop tag in a trailing, untitled group", () => {
    const groups = groupByVolume([
      makeProduct({ id: 999, tags: ["nuevo"] }),
      makeProduct({ id: 101, tags: ["drop-1"] }),
    ]);

    expect(groups.map((group) => group.title)).toEqual(["Volumen I", null]);
    expect(groups[1]?.products.map((product) => product.id)).toEqual([999]);
  });

  it("returns no groups at all for an empty catalogue", () => {
    expect(groupByVolume([])).toEqual([]);
  });
});
