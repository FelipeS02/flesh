import { describe, expect, it } from "vitest";
import { axisMatchesSizeChart, hasSizeChartMeasurements, selectSizeChart } from "../garment";

const rows = [
  { size: "S", measurements: { chest_width: 50 } },
  { size: "M", measurements: { chest_width: 54, sleeve_length: 20 } },
  { size: "L", measurements: { chest_width: 58 } },
] as const;

describe("selectSizeChart", () => {
  it("keeps chart order and sold-out matching sizes for one unique axis", () => {
    expect(selectSizeChart(rows, [{ index: 0, label: "Size", values: ["M", "S", "L"] }])).toEqual(rows);
  });

  it("rejects duplicate normalized chart sizes and ambiguous or absent axes", () => {
    expect(selectSizeChart([{ size: "M", measurements: {} }, { size: " m ", measurements: {} }], [])).toBeNull();
    expect(selectSizeChart(rows, [{ index: 0, label: "Size", values: ["M"] }, { index: 1, label: "Other", values: ["M"] }])).toBeNull();
    expect(selectSizeChart(rows, [{ index: 0, label: "Color", values: ["Black"] }])).toBeNull();
  });
});

/**
 * `InfoAccordions` and the PDP's size-guide trigger both need to agree on
 * "is there anything worth showing" — this is the one rule both read, so a
 * chart with only empty rows cannot show a trigger promising a table that
 * would then render nothing.
 */
describe("hasSizeChartMeasurements", () => {
  it("is false for null, an empty chart, or a chart with no populated row", () => {
    expect(hasSizeChartMeasurements(null)).toBe(false);
    expect(hasSizeChartMeasurements([])).toBe(false);
    expect(hasSizeChartMeasurements([{ size: "M", measurements: {} }])).toBe(false);
  });

  it("is true once at least one row carries a measurement", () => {
    expect(hasSizeChartMeasurements([{ size: "M", measurements: { chest_width: 52 } }])).toBe(true);
  });
});

/**
 * Which axis gets the size-guide trigger is decided from the chart's own
 * sizes, not from the axis's label — a merchant renaming "Talle" to
 * something else must not silently drop the trigger, and a `Color` axis that
 * happens to share a value spelling with a size ("S" the colour vs "S" the
 * size) is deliberately out of scope for this helper, which only reports
 * whether ANY value overlaps.
 */
describe("axisMatchesSizeChart", () => {
  it("matches an axis whose values overlap the chart's sizes, case/whitespace-insensitively", () => {
    expect(axisMatchesSizeChart(["m", " M ", "L"], rows)).toBe(true);
  });

  it("does not match an axis with no overlapping value", () => {
    expect(axisMatchesSizeChart(["Noir", "Bone"], rows)).toBe(false);
  });
});
