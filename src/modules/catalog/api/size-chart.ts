import { z } from "zod";
import {
  measurementKeys,
  type GarmentSize,
  type MeasurementKey,
} from "../domain/garment";
import type { OwnerIndex } from "./fit";

const measurementShape = Object.fromEntries(
  measurementKeys.map((key) => [key, z.number().int().positive().optional()]),
) as Record<MeasurementKey, z.ZodOptional<z.ZodNumber>>;

const SizeRowSchema = z.object({
  size: z.string().trim().min(1),
  ...measurementShape,
});

export const SizeChartFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("object[]"),
  owner_resource: z.literal("product"),
  owners: z.array(z.object({ entity_id: z.string(), value: z.unknown() })),
  has_more: z.boolean(),
});

export type SizeChartField = z.infer<typeof SizeChartFieldSchema>;

export function toSizeChartIndex(field: SizeChartField): OwnerIndex<GarmentSize[]> {
  const values = new Map<number, GarmentSize[]>();
  const diagnostics: string[] = [];
  for (const owner of field.owners) {
    const productId = Number(owner.entity_id);
    const rows = z.array(SizeRowSchema).min(1).safeParse(owner.value);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !rows.success) {
      diagnostics.push(`Ignored malformed Size chart owner ${owner.entity_id}.`);
      continue;
    }
    values.set(
      productId,
      rows.data.map((row) => {
        const measurements: GarmentSize["measurements"] = {};
        for (const key of measurementKeys) {
          if (row[key] !== undefined) measurements[key] = row[key];
        }
        return { size: row.size, measurements };
      }),
    );
  }
  return { values, diagnostics };
}
