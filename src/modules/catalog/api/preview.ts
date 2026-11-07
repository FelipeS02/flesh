import { z } from "zod";
import type { OwnerIndex } from "./fit";

// A native boolean field, created by hand in Tiendanube. Anything that is not a
// bare boolean (a string, an object) is malformed and reads as off.
const PreviewValueSchema = z.boolean();

export const PreviewFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("boolean"),
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
    values.set(productId, preview.data);
  }
  return { values, diagnostics };
}
