import { describe, expect, it } from "vitest";
import type { OptionAxis } from "@/modules/catalog";
import { axisParamKeys, selectionFromQuery } from "./axis-params";

const SIZE: OptionAxis = { index: 0, label: "Talle", values: ["M", "L", "XL"] };
const COLOR: OptionAxis = { index: 1, label: "Color", values: ["Noir", "Bone"] };

describe("axisParamKeys", () => {
  it("derives one key per axis from the merchant's own label", () => {
    expect(axisParamKeys([SIZE, COLOR])).toEqual(["talle", "color"]);
  });

  it("strips diacritics and separators so the key survives a URL", () => {
    const axes: OptionAxis[] = [
      { index: 0, label: "Tamaño / Talle", values: ["M"] },
      { index: 1, label: "  Color  ", values: ["Noir"] },
    ];

    expect(axisParamKeys(axes)).toEqual(["tamano-talle", "color"]);
  });

  it("disambiguates two axes that slugify to the same key", () => {
    const axes: OptionAxis[] = [
      { index: 0, label: "Color", values: ["Noir"] },
      { index: 1, label: "COLOR!", values: ["Bone"] },
    ];

    expect(axisParamKeys(axes)).toEqual(["color", "color-2"]);
  });

  it("falls back to a positional key when a label carries no usable characters", () => {
    const axes: OptionAxis[] = [{ index: 0, label: "///", values: ["M"] }];

    expect(axisParamKeys(axes)).toEqual(["opcion-1"]);
  });

  it("returns nothing for a product with no axes", () => {
    expect(axisParamKeys([])).toEqual([]);
  });
});

describe("selectionFromQuery", () => {
  it("resolves each param to the axis value the merchant actually typed", () => {
    expect(selectionFromQuery([SIZE, COLOR], { talle: "m", color: "noir" })).toEqual([
      "M",
      "Noir",
    ]);
  });

  it("leaves an axis unchosen when its param is absent", () => {
    expect(selectionFromQuery([SIZE, COLOR], { color: "bone" })).toEqual([
      null,
      "Bone",
    ]);
  });

  it("leaves an axis unchosen when the param names no value of that axis", () => {
    expect(selectionFromQuery([SIZE, COLOR], { talle: "xxl" })).toEqual([null, null]);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(selectionFromQuery([SIZE], { talle: "  xL " })).toEqual(["XL"]);
  });

  it("yields an empty selection for a product with no axes", () => {
    expect(selectionFromQuery([], { talle: "m" })).toEqual([]);
  });
});
