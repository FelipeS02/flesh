import { describe, expect, it } from "vitest";
import { getProducts } from "@/modules/catalog";
import type { OptionAxis, ProductView } from "@/modules/catalog/client";
import { CUTS, findGarmentCut, findSizeAxis, sizesOf } from "./cuts";

function productWith(
  tags: string[],
  axes: OptionAxis[] = [],
): Pick<ProductView, "tags" | "axes"> {
  return { tags, axes };
}

const SIZE_AXIS: OptionAxis = { index: 0, label: "Talle", values: ["M", "L", "XL"] };
const COLOR_AXIS: OptionAxis = { index: 1, label: "Color", values: ["Noir", "Bone"] };

describe("findGarmentCut", () => {
  it("resolves the cut a product's `corte-` tag names", () => {
    const cut = findGarmentCut(productWith(["nuevo", "drop-1", "corte-remera-oversize"]));

    expect(cut?.key).toBe("remera-oversize");
    expect(cut?.fit).toBe("baggy");
  });

  it("returns nothing when the product carries no cut tag", () => {
    expect(findGarmentCut(productWith(["nuevo", "drop-1"]))).toBeNull();
  });

  it("refuses to guess when a product carries two cut tags", () => {
    // Two patterns means two measurement tables, and picking either one is
    // inventing an answer nobody gave.
    expect(
      findGarmentCut(productWith(["corte-remera-oversize", "corte-buzo-boxy"])),
    ).toBeNull();
  });

  it("returns nothing for a cut tag naming a pattern we do not have", () => {
    expect(findGarmentCut(productWith(["corte-pantalon-wide"]))).toBeNull();
  });

  it("reads the tag case-insensitively", () => {
    expect(findGarmentCut(productWith(["CORTE-Remera-Oversize"]))?.key).toBe(
      "remera-oversize",
    );
  });
});

describe("findSizeAxis", () => {
  it("finds the axis whose values are all size tokens", () => {
    expect(findSizeAxis({ axes: [COLOR_AXIS, SIZE_AXIS] })?.label).toBe("Talle");
  });

  it("detects sizes by VALUE, so a colour axis never qualifies", () => {
    expect(findSizeAxis({ axes: [COLOR_AXIS] })).toBeNull();
  });

  it("ignores casing and stray whitespace in the values", () => {
    const axis: OptionAxis = { index: 0, label: "Tamaño", values: [" m ", "xl"] };

    expect(findSizeAxis({ axes: [axis] })?.label).toBe("Tamaño");
  });

  it("rejects an axis where only some values are sizes", () => {
    const axis: OptionAxis = { index: 0, label: "Talle", values: ["M", "Noir"] };

    expect(findSizeAxis({ axes: [axis] })).toBeNull();
  });

  it("returns nothing for a product with no axes", () => {
    expect(findSizeAxis({ axes: [] })).toBeNull();
  });
});

describe("the cut registry's own consistency", () => {
  it("gives every measurement a value for every size the cut lists", () => {
    for (const cut of Object.values(CUTS)) {
      for (const measurement of cut.measurements) {
        expect(Object.keys(measurement.bySize).sort()).toEqual([...sizesOf(cut)].sort());
      }
    }
  });
});

// The guard that matters. A cut's table is only true if it covers every size
// the product is actually sold in — a table missing a row for a size on sale
// is a measurement the shopper will guess at, and a wrong guess comes back as
// a return. This fails at build time instead of on the PDP.
describe("every catalogue product's cut covers the sizes it sells", () => {
  it("has no product whose size axis outruns its cut's table", () => {
    for (const product of getProducts()) {
      const cut = findGarmentCut(product);
      const axis = findSizeAxis(product);
      if (!cut || !axis) {
        continue;
      }

      const covered = new Set([...sizesOf(cut)].map((size) => size.toLowerCase()));
      const uncovered = axis.values.filter(
        (value) => !covered.has(value.trim().toLowerCase()),
      );

      expect({ product: product.slug, uncovered }).toEqual({
        product: product.slug,
        uncovered: [],
      });
    }
  });
});
