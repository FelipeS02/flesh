import { z } from "zod";
import type { OwnerIndex } from "./fit";

// `.strict()`: a value carrying anything beyond `enabled` was written by
// something that is not our script, so it is treated as malformed (off) rather
// than trusted for the one flag that decides whether a product can be sold.
const PreviewValueSchema = z.object({ enabled: z.boolean() }).strict();

export const PreviewFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("object"),
  owner_resource: z.literal("product"),
  owners: z.array(z.object({ entity_id: z.string(), value: z.unknown() })),
  has_more: z.boolean(),
});

export type PreviewField = z.infer<typeof PreviewFieldSchema>;

/**
 * Product id -> "is this an unreleased product". A malformed owner is absent
 * from the map and reported, never thrown: a bad value must not take the whole
 * catalogue down, and absent already reads as "released".
 */
export function toPreviewIndex(field: PreviewField): OwnerIndex<boolean> {
  const values = new Map<number, boolean>();
  const diagnostics: string[] = [];
  for (const owner of field.owners) {
    const productId = Number(owner.entity_id);
    const preview = PreviewValueSchema.safeParse(owner.value);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !preview.success) {
      diagnostics.push(`Ignored malformed Preview owner ${owner.entity_id}.`);
      continue;
    }
    values.set(productId, preview.data.enabled);
  }
  return { values, diagnostics };
}
