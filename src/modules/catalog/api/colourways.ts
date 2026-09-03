import { z } from "zod";
import type { Colourway } from "../domain/colourway";
import { CatalogContractError } from "../domain/product";

// Wire contract for Tiendanube's PRODUCT CUSTOM FIELDS — a resource of its
// own, not part of the product payload. It is fetched separately, which is
// why this lives beside `./schema.ts` rather than inside `ProductSchema`.
//
// Verified against the live store, not inferred:
// - The admin shows the field's identifier as `product.metafields_v2.custom.<key>`.
//   That is a THEME identifier. No `metafields_v2` route exists on the REST
//   API — every guess returns 404.
// - The data is served ONLY by the `unstable` API version. `v1` and `2025-03`
//   answer the very same endpoints with `200 []`, silently. Valid versions are
//   exactly `v1`, `2025-03` and `unstable`.
// - The batch read is `GET /products/custom-fields/{field_id}/owners`: one
//   request returns EVERY product's value, so the whole colour index costs a
//   single call against the 40-request / 2-per-second leaky bucket. The
//   per-product route (`GET /products/{id}/custom-fields`) exists but would be
//   one request per product.
// - `?include=custom_fields` on `/products` is silently IGNORED (200, no key)
//   and `?fields=custom_fields` is a 422. There is no inline retrieval.
// - The platform LOWERCASES property keys. A merchant who types `colorName`
//   gets `colorname` on the wire; the typed casing survives only in the
//   definition's `schema.properties.<key>.label`. These schemas therefore name
//   the lowercase keys, which is what actually arrives.

/**
 * One product's own colourway. `object[]` is the field's declared type, so a
 * value always arrives as an array — carrying exactly one entry, because a
 * garment is one colour. See `toColourwayIndex` for that assertion.
 */
export const ColourwayValueSchema = z.object({
  hex: z.string(),
  colorname: z.string(),
  group: z.string(),
});

/**
 * `entity_id` is a STRING here while `product.id` is a NUMBER — the join
 * across these two resources needs a conversion, and comparing them raw
 * silently matches nothing.
 */
export const ColourwayOwnerSchema = z.object({
  entity_id: z.string(),
  value: z.array(ColourwayValueSchema),
});

export const ColourwayFieldSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  key: z.string(),
  value_type: z.literal("object[]"),
  owner_resource: z.literal("product"),
  owners: z.array(ColourwayOwnerSchema),
  has_more: z.boolean(),
});

export type ColourwayField = z.infer<typeof ColourwayFieldSchema>;

/**
 * Turns the custom field's owner list into a product-id-keyed index.
 *
 * The caller joins this against the catalogue, and the join must be an INNER
 * one: `owners[]` outlives the products in it. The live store returned four
 * owners for a two-product catalogue — the other two ids answer
 * `404 "Product with such id does not exist"`. Deleted products keep their
 * custom-field values, so this list is never a source of truth about what the
 * catalogue contains.
 */
export function toColourwayIndex(field: ColourwayField): Map<number, Colourway> {
  const index = new Map<number, Colourway>();

  for (const owner of field.owners) {
    const productId = Number(owner.entity_id);

    // A garment is one colour. Two values is the merchant having filled the
    // field as a list of siblings — the shape this model deliberately rejects
    // — and picking the first would quietly choose a colour for them.
    if (owner.value.length !== 1) {
      throw CatalogContractError.ambiguousColourway(
        productId,
        owner.value.length,
      );
    }

    const [value] = owner.value as [z.infer<typeof ColourwayValueSchema>];
    index.set(productId, {
      group: value.group,
      hex: value.hex,
      name: value.colorname,
    });
  }

  return index;
}
