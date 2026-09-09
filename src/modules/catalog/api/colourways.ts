import { z } from "zod";
import type { Colourway } from "../domain/colourway";

/** The structured value of the merchant-owned `custom/colourway` field. */
export const ColourwayValueSchema = z.object({
  hex: z.string(),
  color_name: z.string(),
  group: z.string(),
});

/** Owner ids are strings on the wire and are validated during indexing. */
export const ColourwayOwnerSchema = z.object({
  entity_id: z.string(),
  value: ColourwayValueSchema,
});

export const ColourwayFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("object"),
  owner_resource: z.literal("product"),
  owners: z.array(ColourwayOwnerSchema),
  has_more: z.boolean(),
});

export type ColourwayField = z.infer<typeof ColourwayFieldSchema>;

/**
 * Indexes valid optional owner values without allowing stale or malformed
 * owner identifiers to poison the catalog snapshot.
 */
export function toColourwayIndex(field: ColourwayField): {
  values: Map<number, Colourway>;
  diagnostics: string[];
} {
  const values = new Map<number, Colourway>();
  const diagnostics: string[] = [];

  for (const owner of field.owners) {
    const productId = Number(owner.entity_id);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      diagnostics.push(`Ignored malformed Colourway owner ${owner.entity_id}.`);
      continue;
    }

    values.set(productId, {
      group: owner.value.group,
      hex: owner.value.hex,
      name: owner.value.color_name,
    });
  }

  return { values, diagnostics };
}
