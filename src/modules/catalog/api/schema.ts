import { z } from "zod";

// Zod schemas for the verbatim Tiendanube wire contract. These are the
// single source of truth for wire *shape* — hand-written types are derived
// from these via `z.infer` in `./types.ts`, never duplicated by hand.
//
// Verified contract facts (Tiendanube product resource):
// - Prices (`price`, `promotional_price`, `cost`) and `weight` are STRINGS,
//   e.g. "25.00" — never numbers. Parsing to minor units is the mapper's job
//   (PR4b), not this schema's.
// - `name`, `description`, `handle`, and each entry of `attributes` are
//   language-keyed objects ({en, es, pt}), never plain strings.
// - `description` contains HTML — sanitisation happens in the mapper (PR4c),
//   not here.
// - A product carries at most 3 `attributes`; each variant's `values` array
//   correlates with `attributes` POSITIONALLY (index-to-index), with no
//   linking key. That correlation invariant is asserted in the mapper
//   (PR4b) — this schema only validates that both are arrays of the right
//   element shape.
// - `stock` is a number paired with a `stock_management` boolean. Sold-out
//   is `stock_management && stock <= 0` — computed in the mapper, not here.
// - `images[]` carry `id`, `src`, `position`, `product_id`; ordering by
//   `position` happens in the mapper.
// - `visibility` is `"visible" | "unlisted" | "hidden"`; a legacy `published`
//   boolean also exists.
// - `categories[]` are nested objects with a nullable `parent` and a
//   `subcategories` array of the same shape.
// - `tags` is a single comma-separated STRING, not an array.
// - Timestamps are ISO 8601 strings.

export const LangTextSchema = z.object({
  en: z.string(),
  es: z.string(),
  pt: z.string(),
});

export const VisibilitySchema = z.enum(["visible", "unlisted", "hidden"]);

// Categories nest via `parent` (nullable, same shape) and `subcategories`
// (array of the same shape) — a genuinely recursive wire structure, so the
// schema is declared with an explicit `z.ZodType` annotation to let the
// lazy fields type-check without infinite recursion.
export interface TiendanubeCategoryShape {
  id: number;
  name: z.infer<typeof LangTextSchema>;
  parent: TiendanubeCategoryShape | null;
  subcategories: TiendanubeCategoryShape[];
}

export const CategorySchema: z.ZodType<TiendanubeCategoryShape> = z.object({
  id: z.number(),
  name: LangTextSchema,
  parent: z.lazy(() => CategorySchema.nullable()),
  subcategories: z.lazy(() => z.array(CategorySchema)),
});

export const ImageSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  src: z.string(),
  position: z.number(),
});

export const VariantSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  price: z.string(),
  promotional_price: z.string().nullable(),
  cost: z.string().nullable(),
  stock: z.number().nullable(),
  stock_management: z.boolean(),
  weight: z.string(),
  values: z.array(LangTextSchema),
  sku: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProductSchema = z.object({
  id: z.number(),
  name: LangTextSchema,
  description: LangTextSchema,
  handle: LangTextSchema,
  // Platform ceiling — Tiendanube caps a product at 3 attributes.
  attributes: z.array(LangTextSchema).max(3),
  // Platform ceiling — up to 1000 variants per product.
  variants: z.array(VariantSchema).max(1000),
  images: z.array(ImageSchema),
  categories: z.array(CategorySchema),
  tags: z.string(),
  published: z.boolean(),
  visibility: VisibilitySchema,
  created_at: z.string(),
  updated_at: z.string(),
});
