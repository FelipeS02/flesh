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
