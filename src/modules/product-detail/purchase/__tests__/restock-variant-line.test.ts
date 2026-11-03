import { describe, expect, it } from "vitest";
import { restockVariantLine } from "../restock-variant-line";

describe("restockVariantLine", () => {
  it("names the colourway first, then each axis value", () => {
    expect(restockVariantLine("Negro", ["M"])).toBe("NEGRO · M");
  });

  it("joins several axes in order", () => {
    expect(restockVariantLine("Bone", ["M", "Oversize"])).toBe("BONE · M · OVERSIZE");
  });

  // A product whose own axis already carries the colour must not say it twice.
  it("does not repeat a colour the combination already contains", () => {
    expect(restockVariantLine("Negro", ["negro", "M"])).toBe("NEGRO · M");
  });

  it("falls back to the combination alone when the page has no colourway", () => {
    expect(restockVariantLine(null, ["M"])).toBe("M");
  });

  it("upper-cases accented text with the Spanish locale rules", () => {
    expect(restockVariantLine("Ámbar", ["XL"])).toBe("ÁMBAR · XL");
  });
});
