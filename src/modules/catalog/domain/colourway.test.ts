import { describe, expect, it } from "vitest";
import { makeProduct } from "../../../../test/fixtures/product-view";
import { buildColourwayIndex, colourwayLinks } from "./colourway";

const black = makeProduct({
  id: 101,
  slug: "remera-cruz-negra",
  colourway: { group: "remera-cruz", hex: "#0A0A0A", name: "Noir" },
});

const bone = makeProduct({
  id: 102,
  slug: "remera-cruz-hueso",
  colourway: { group: "remera-cruz", hex: "#E8E4DA", name: "Bone" },
});

const hoodie = makeProduct({
  id: 103,
  slug: "buzo-oversize",
  colourway: null,
});

describe("buildColourwayIndex", () => {
  it("gathers every colour of a group under its shared key", () => {
    const index = buildColourwayIndex([black, bone, hoodie]);

    expect([...index.keys()]).toEqual(["remera-cruz"]);
    expect(index.get("remera-cruz")).toEqual([
      { hex: "#0A0A0A", name: "Noir", slug: "remera-cruz-negra", inStock: true },
      { hex: "#E8E4DA", name: "Bone", slug: "remera-cruz-hueso", inStock: true },
    ]);
  });

  it("keeps catalogue order, so the swatch row does not reshuffle between builds", () => {
    const index = buildColourwayIndex([bone, black]);

    expect(index.get("remera-cruz")?.map((link) => link.slug)).toEqual([
      "remera-cruz-hueso",
      "remera-cruz-negra",
    ]);
  });

  it("carries each colour's own stock, since a sold-out colour is still a colour", () => {
    const soldOut = makeProduct({
      id: bone.id,
      slug: bone.slug,
      colourway: bone.colourway,
      variants: [{ ...bone.variants[0]!, inStock: false }],
    });

    const links = buildColourwayIndex([black, soldOut]).get("remera-cruz");

    expect(links?.map((link) => link.inStock)).toEqual([true, false]);
  });

  it("ignores products that belong to no group", () => {
    expect(buildColourwayIndex([hoodie]).size).toBe(0);
  });
});

describe("colourwayLinks", () => {
  it("returns the whole group, the product's own colour included", () => {
    const index = buildColourwayIndex([black, bone]);

    expect(colourwayLinks(index, black).map((link) => link.slug)).toEqual([
      "remera-cruz-negra",
      "remera-cruz-hueso",
    ]);
  });

  it("returns nothing for a lone colour — one dot names no choice", () => {
    const index = buildColourwayIndex([black]);

    expect(colourwayLinks(index, black)).toEqual([]);
  });

  it("returns nothing for a product outside any group", () => {
    expect(colourwayLinks(buildColourwayIndex([black, bone]), hoodie)).toEqual([]);
  });
});
