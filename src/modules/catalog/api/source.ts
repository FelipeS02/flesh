// Tiendanube's Admin REST API is the only place this data can eventually
// come from — there is no public storefront API, only an admin-only,
// token-gated endpoint (see `./port.ts`'s reference doc). That token must
// never reach the browser. `import "server-only"` establishes that boundary
// now, on the mock, before the real fetch layer exists, so it is never
// retrofitted later.
import "server-only";
import {
  buildColourwayIndex,
  type ColourwayIndex,
} from "../domain/colourway";
import { mapToProductView } from "../domain/map";
import type { ProductView } from "../domain/product";
import { ColourwayFieldSchema, toColourwayIndex } from "./colourways";
import { colourwayField as rawColourwayField } from "./fixtures/colourways";
import { products as rawProducts } from "./fixtures/products";
import { ProductSchema } from "./schema";
import type { TiendanubeProduct } from "./types";
import type { CatalogPort } from "./port";

// Validate fixture data through the wire schema at this boundary — the same
// boundary a live Tiendanube client would validate its HTTP responses at.
const parsedProducts: TiendanubeProduct[] = rawProducts.map((product) =>
  ProductSchema.parse(product),
);

// The colourways are a SECOND resource, validated at the same boundary. In a
// live client this is one extra request — `GET /products/custom-fields/{id}
// /owners` returns every product's colour at once, so the whole index costs a
// single call rather than one per product.
const colourways = toColourwayIndex(
  ColourwayFieldSchema.parse(rawColourwayField),
);

// Mapping happens per call, not once at module load, so a product that
// violates the mapper's contract throws where it is actually requested
// rather than taking down the whole module at import time. `getProducts`
// lets that throw propagate today — a tolerant policy (drop the malformed
// product from listings) belongs at this same swap point later, and is a
// documented seam, not something built now.
function toView(product: TiendanubeProduct): ProductView {
  return mapToProductView(product, colourways.get(product.id) ?? null);
}

function getProducts(): ProductView[] {
  return parsedProducts
    .filter((product) => product.visibility === "visible")
    .map((product) => toView(product));
}

/**
 * The colour index is built from EVERY product, not from `getProducts()`.
 *
 * A design's secondary colours are `unlisted` so the grid draws one card per
 * design — which makes them exactly the products the listing filters out, and
 * exactly the siblings a swatch row has to link to. Building the index off
 * the filtered list would leave every row with a single dot.
 *
 * The join is inner by construction: `owners[]` outlives its products (the
 * live store returns ids that 404), and an id with no product here simply
 * never becomes a `ProductView`.
 */
function getColourwayIndex(): ColourwayIndex {
  return buildColourwayIndex(parsedProducts.map((product) => toView(product)));
}

function getProductByHandle(slug: string): ProductView | null {
  // Pure in-memory scan over already-parsed fixture data — never touches
  // fs/path/network, so a traversal-shaped slug (e.g. "../../etc/passwd")
  // simply fails to match and returns null, the same as any other unknown
  // slug. UI copy is Spanish (see decision: scope-and-locale), so the
  // routing-level lookup compares against the Spanish handle directly; the
  // general-purpose locale accessor for arbitrary domain fields is the
  // mapper's concern (PR4b), not this wire-boundary lookup.
  const product = parsedProducts.find((wire) => wire.handle.es === slug);
  return product ? toView(product) : null;
}

// Provably interchangeable with a future `source.tiendanube.ts`, not just
// similarly named — `satisfies CatalogPort` is a compile-time check.
export { getProducts, getProductByHandle, getColourwayIndex };
export const source = {
  getProducts,
  getProductByHandle,
  getColourwayIndex,
} satisfies CatalogPort;
