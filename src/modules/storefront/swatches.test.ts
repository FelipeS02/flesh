import { describe, expect, it } from "vitest";
import { makeProduct } from "../../../test/fixtures/product-view";
import { findSwatchAxis, swatchColor } from "./swatches";

describe("swatchColor", () => {
  it("resolves a registered colour name, whatever its casing", () => {
    expect(swatchColor("Noir")).toBe("#0A0A0A");
    expect(swatchColor("BONE")).toBe("#E8E4DA");
  });

  it("returns null for a value that names no registered colour", () => {
    expect(swatchColor("M")).toBeNull();
  });
});

describe("findSwatchAxis", () => {
  it("picks the axis whose every value is a registered colour, by value not by label", () => {
    const product = makeProduct({
      axes: [
        { index: 0, label: "Talle", values: ["M", "L"] },
        { index: 1, label: "Color", values: ["Noir", "Bone"] },
      ],
    });

    expect(findSwatchAxis(product)?.index).toBe(1);
  });

  it("returns null when no axis is made of colours", () => {
    const product = makeProduct({
      axes: [{ index: 0, label: "Talle", values: ["M", "L"] }],
    });

    expect(findSwatchAxis(product)).toBeNull();
  });

  it("returns null for a product with no axes at all", () => {
    expect(findSwatchAxis(makeProduct())).toBeNull();
  });
});
