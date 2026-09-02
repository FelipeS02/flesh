import type { TiendanubeProduct } from "./types";

// The ONE interface a future Tiendanube client and today's mock data source
// must both satisfy. This is the formal swap point: a later
// `source.tiendanube.ts` becomes a second implementation of this same
// contract, provably interchangeable with the mock rather than merely
// similarly named.
//
// Naming note: the design's domain view type (`Product`/`ProductView`,
// produced by the mapper in PR4b) does not exist yet in this slice — the
// mapper that turns wire-shaped data into that domain view is explicitly
// out of scope here. This port is therefore typed over the schema-derived
// wire type (`TiendanubeProduct`, see `./types.ts`), which is the only
// "product" type that exists at this point in the chain. The mapper (PR4b)
// composes on top of this port's output.
export interface CatalogPort {
  getProducts(): Promise<TiendanubeProduct[]> | TiendanubeProduct[];
  getProductByHandle(
    slug: string,
  ): Promise<TiendanubeProduct | null> | TiendanubeProduct | null;
}

// Reference documentation only — NOT implemented in this change. Recorded
// here for the future integrator building `source.tiendanube.ts` against
// this same `CatalogPort`.
//
// Tiendanube Admin REST API facts (verified, not shipped):
// - Versioned base URL: `https://api.tiendanube.com/2025-03/{store_id}`
// - Mandatory `User-Agent` header — requests without it receive HTTP 400.
// - Auth: `Authorization: Bearer <token>` (admin-only API; there is no
//   public storefront API — this is exactly why `source.ts` carries
//   `import "server-only"`, see task 4a.14).
// - Rate limit: leaky bucket, 40 request bucket size, 2 requests/second
//   sustained (10x on higher plan tiers), reported via `x-rate-limit-*`
//   response headers. This implies the eventual live implementation needs
//   caching, not per-request fetching.
