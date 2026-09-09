import { z } from "zod";
import type { GarmentFit } from "../domain/garment";

const FitValueSchema = z.object({
  type: z.enum(["top", "bottom"]),
  position: z.number().int().min(0).max(100),
});

export const FitFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("object"),
  owner_resource: z.literal("product"),
  owners: z.array(z.object({ entity_id: z.string(), value: z.unknown() })),
  has_more: z.boolean(),
});

export type FitField = z.infer<typeof FitFieldSchema>;
export type OwnerIndex<T> = { values: Map<number, T>; diagnostics: string[] };

export function toFitIndex(field: FitField): OwnerIndex<GarmentFit> {
  const values = new Map<number, GarmentFit>();
  const diagnostics: string[] = [];
  for (const owner of field.owners) {
    const productId = Number(owner.entity_id);
    const fit = FitValueSchema.safeParse(owner.value);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !fit.success) {
      diagnostics.push(`Ignored malformed Fit owner ${owner.entity_id}.`);
      continue;
    }
    values.set(productId, fit.data);
  }
  return { values, diagnostics };
}
