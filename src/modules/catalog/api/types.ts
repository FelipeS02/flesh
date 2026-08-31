import type { z } from "zod";
import type {
  CategorySchema,
  ImageSchema,
  LangTextSchema,
  ProductSchema,
  VariantSchema,
  VisibilitySchema,
} from "./schema";

// Wire types are DERIVED from the Zod schemas, never hand-written — the
// schema in `./schema.ts` is the single source of truth for shape.
// These remain internal to the `api/` boundary; the module index
// (`catalog/index.ts`) never re-exports them.

export type LangText = z.infer<typeof LangTextSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type TiendanubeCategory = z.infer<typeof CategorySchema>;
export type TiendanubeImage = z.infer<typeof ImageSchema>;
export type TiendanubeVariant = z.infer<typeof VariantSchema>;
export type TiendanubeProduct = z.infer<typeof ProductSchema>;
