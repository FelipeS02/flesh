import type { TiendanubeProduct } from "../types";

// Tiendanube-faithful mock data — shaped to the REAL wire contract, not an
// invented convenience shape (see decision: product-data-source). Kept as
// `.ts` with `satisfies` rather than `.json`: `resolveJsonModule` is on, so a
// JSON import would infer a wide structural type and let contract drift
// compile clean. `satisfies` both checks against the schema-derived type and
// preserves the literal types.
//
// One deliberate departure from a live payload: image `src` values are paths
// into `public/` rather than absolute CDN URLs, so the mock renders the real
// garments in `next dev` instead of broken images. A live Tiendanube response
// carries absolute URLs here — that swap will also need `images.remotePatterns`
// in `next.config.ts` before `next/image` will load them.
export const products = [
  {
    id: 101,
    name: { en: "Classic Tee", es: "Remera Classic", pt: "Camiseta Classic" },
    description: {
      en: "<p>A classic tee, drop 1.</p>",
      es: "<p>Una remera clásica, drop 1.</p>",
      pt: "<p>Uma camiseta clássica, drop 1.</p>",
    },
    handle: {
      en: "classic-tee",
      es: "remera-classic",
      pt: "camiseta-classic",
    },
    attributes: [
      { en: "Size", es: "Talle", pt: "Tamanho" },
      { en: "Color", es: "Color", pt: "Cor" },
    ],
    variants: [
      {
        id: 201,
        product_id: 101,
        price: "25.00",
        promotional_price: "19.00",
        cost: "10.99",
        stock: 5,
        stock_management: true,
        weight: "2.00",
        values: [
          { en: "M", es: "M", pt: "M" },
          { en: "Black", es: "Negro", pt: "Preto" },
        ],
        sku: "TEE-M-BLK",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: 202,
        product_id: 101,
        price: "25.00",
        promotional_price: null,
        cost: "10.99",
        stock: 0,
        stock_management: true,
        weight: "2.00",
        values: [
          { en: "S", es: "S", pt: "S" },
          { en: "Black", es: "Negro", pt: "Preto" },
        ],
        sku: "TEE-S-BLK",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [
      {
        id: 301,
        product_id: 101,
        src: "/products/1.png",
        position: 1,
      },
      {
        id: 302,
        product_id: 101,
        src: "/products/2.png",
        position: 2,
      },
    ],
    categories: [
      {
        id: 401,
        name: { en: "Tops", es: "Remeras", pt: "Camisetas" },
        parent: null,
        subcategories: [],
      },
    ],
    // `corte-*` names the PATTERN this garment is cut from, and both the fit
    // scale and the size table hang off it (see `product-detail/garment/cuts`).
    tags: "nuevo,drop-1,corte-remera-oversize",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: 102,
    name: {
      en: "Oversize Hoodie",
      es: "Buzo Oversize",
      pt: "Moletom Oversize",
    },
    description: {
      en: "<p>One size, no variants.</p>",
      es: "<p>Talle único, sin variantes.</p>",
      pt: "<p>Tamanho único, sem variantes.</p>",
    },
    handle: {
      en: "oversize-hoodie",
      es: "buzo-oversize",
      pt: "moletom-oversize",
    },
    // Zero attributes — edge case the mapper (PR4b) must handle cleanly:
    // axes=[] and resolveVariant returns the single variant.
    attributes: [],
    variants: [
      {
        id: 203,
        product_id: 102,
        price: "45.00",
        promotional_price: null,
        cost: "22.50",
        stock: 12,
        stock_management: false,
        weight: "6.00",
        values: [],
        sku: "HOODIE-OS",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [
      {
        id: 303,
        product_id: 102,
        src: "/products/4.webp",
        position: 1,
      },
    ],
    categories: [
      {
        id: 402,
        name: { en: "Outerwear", es: "Abrigo", pt: "Agasalho" },
        parent: null,
        subcategories: [],
      },
    ],
    tags: "nuevo,drop-1",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: 103,
    name: {
      en: "Limited Cap",
      es: "Gorra Limitada",
      pt: "Boné Limitado",
    },
    description: {
      en: "<p>Not yet on sale.</p>",
      es: "<p>Todavía no a la venta.</p>",
      pt: "<p>Ainda não à venda.</p>",
    },
    handle: {
      en: "limited-cap",
      es: "gorra-limitada",
      pt: "bone-limitado",
    },
    attributes: [{ en: "Color", es: "Color", pt: "Cor" }],
    variants: [
      {
        id: 204,
        product_id: 103,
        price: "15.00",
        promotional_price: null,
        cost: "5.00",
        stock: 0,
        stock_management: true,
        weight: "0.50",
        values: [{ en: "Red", es: "Rojo", pt: "Vermelho" }],
        sku: "CAP-RED",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [
      {
        id: 304,
        product_id: 103,
        src: "/products/3.webp",
        position: 1,
      },
    ],
    categories: [],
    tags: "proximamente",
    published: false,
    // Unlisted — must be excluded by getProducts()'s visibility filter.
    visibility: "unlisted",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
] satisfies TiendanubeProduct[];
