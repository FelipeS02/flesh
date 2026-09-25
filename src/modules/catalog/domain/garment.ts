export type GarmentFit = {
  type: "top" | "bottom";
  position: number;
};

export const measurementKeys = [
  "back_width",
  "chest_width",
  "waist_width",
  "garment_length",
  "sleeve_length",
  "front_rise",
  "leg_opening",
] as const;

export type MeasurementKey = (typeof measurementKeys)[number];

export type GarmentSize = {
  size: string;
  measurements: Partial<Record<MeasurementKey, number>>;
};

type Axis = { index?: number; label?: string; values: readonly string[] };

export function normalizeGarmentSize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function selectSizeChart(
  rows: readonly GarmentSize[],
  axes: readonly Axis[],
): GarmentSize[] | null {
  const normalizedRows = rows.map((row) => normalizeGarmentSize(row.size));
  if (
    rows.length === 0 ||
    normalizedRows.some((size, index) => normalizedRows.indexOf(size) !== index)
  ) {
    return null;
  }

  const chartSizes = new Set(normalizedRows);
  const matchingAxes = axes.filter((axis) =>
    axis.values.some((value) => chartSizes.has(normalizeGarmentSize(value))),
  );
  if (matchingAxes.length !== 1) {
    return null;
  }

  const soldSizes = new Set(
    matchingAxes[0]!.values.map((value) => normalizeGarmentSize(value)),
  );
  const selected = rows.filter((row) => soldSizes.has(normalizeGarmentSize(row.size)));
  return selected.length > 0 ? selected.map((row) => ({ ...row, measurements: { ...row.measurements } })) : null;
}

/**
 * Whether a size chart has anything worth showing.
 *
 * `InfoAccordions` and the PDP's size-guide trigger both decide "does a size
 * table belong on this page" from this ONE rule — a chart of rows that carry
 * no measurement at all would render an empty `<table>`, and a trigger that
 * opened onto that would be worse than no trigger.
 */
export function hasSizeChartMeasurements(
  sizeChart: readonly GarmentSize[] | null | undefined,
): sizeChart is readonly GarmentSize[] {
  return !!sizeChart && sizeChart.some((size) => Object.keys(size.measurements).length > 0);
}

/**
 * Whether an axis IS the size axis, decided from the chart's own sizes
 * rather than the axis's label.
 *
 * A label check like `/talle/i` breaks the moment a merchant renames the
 * axis, or a translation changes it; comparing against the chart's actual
 * sizes can never drift from what the table underneath will show, because
 * it is reading the same data the table reads.
 */
export function axisMatchesSizeChart(
  values: readonly string[],
  sizeChart: readonly GarmentSize[],
): boolean {
  const chartSizes = new Set(sizeChart.map((row) => normalizeGarmentSize(row.size)));
  return values.some((value) => chartSizes.has(normalizeGarmentSize(value)));
}
