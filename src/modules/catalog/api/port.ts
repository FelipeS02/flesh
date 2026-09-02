import type { ProductView } from "../domain/product";

// The ONE interface a future Tiendanube client and today's mock data source
// must both satisfy. This is the formal swap point: a later
// `source.tiendanube.ts` becomes a second implementation of this same
// contract, provably interchangeable with the mock rather than merely
// similarly named.
//
// The port is typed over the DOMAIN view, not the wire type. Mapping is part
// of what an implementation owes its callers — a live client that returned
// raw Tiendanube payloads would push `{en,es,pt}` objects and price strings
// into every consumer, which is exactly what design decision 1 exists to
// prevent. Wire types stay private to `api/**`.
export interface CatalogPort {
  getProducts(): Promise<ProductView[]> | ProductView[];
  getProductByHandle(
    slug: string,
  ): Promise<ProductView | null> | ProductView | null;
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
