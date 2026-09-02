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

  // ---------------------------------------------------------------------
  // Review catalogue — one product per product STATE.
  //
  // These exist to be looked at, not to be asserted against. A unit test
  // proves the code does what its author believed; it cannot say whether that
  // belief was right, whether the badge is legible over a dark photo, or
  // whether "Sin stock" fits the button. Those are judgements, and a judgement
  // needs something to look at.
  //
  // Every one is `visible`, `drop-1` and reachable from the landing, so the
  // whole set can be walked in a browser. They are the first thing to delete
  // when the live Tiendanube client lands — see `CatalogPort`.
  //
  // The states the products above ALREADY cover, and which are not repeated
  // here: `nuevo` + a promotional price + one sold-out variant (101), no
  // attributes at all (102), and `unlisted` (103).
  // ---------------------------------------------------------------------

  {
    // AGOTADO. Every variant out of stock, so the PDP dims the photo, badges
    // the garment and the button names the reason.
    id: 104,
    name: { en: "Sold Out Tee", es: "Remera Agotada", pt: "Camiseta Esgotada" },
    description: {
      en: "<p>Every size gone. The state the catalogue card does not draw yet.</p>",
      es: "<p>Sin stock en todos los talles. El estado que la card todavía no dibuja.</p>",
      pt: "<p>Sem estoque em todos os tamanhos.</p>",
    },
    handle: {
      en: "sold-out-tee",
      es: "remera-agotada",
      pt: "camiseta-esgotada",
    },
    attributes: [{ en: "Size", es: "Talle", pt: "Tamanho" }],
    // Three sizes rather than the two on 101, so the size table is worth
    // opening: this is the only fixture that fills the artboard's M/L/XL grid.
    variants: [
      {
        id: 205,
        product_id: 104,
        price: "25.00",
        promotional_price: null,
        cost: "10.99",
        stock: 0,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "M", es: "M", pt: "M" }],
        sku: "SOLD-M",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: 206,
        product_id: 104,
        price: "25.00",
        promotional_price: null,
        cost: "10.99",
        stock: 0,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "L", es: "L", pt: "L" }],
        sku: "SOLD-L",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: 207,
        product_id: 104,
        price: "25.00",
        promotional_price: null,
        cost: "10.99",
        stock: 0,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "XL", es: "XL", pt: "XL" }],
        sku: "SOLD-XL",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [{ id: 305, product_id: 104, src: "/products/1.png", position: 1 }],
    categories: [],
    tags: "drop-1,corte-remera-oversize",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },

  {
    // DESTACADO, and nothing else — the badge on its own, at full price.
    id: 105,
    name: { en: "Featured Tee", es: "Remera Destacada", pt: "Camiseta Destaque" },
    description: {
      en: "<p>Picked out by the brand. No markdown.</p>",
      es: "<p>Elegida por la marca. Sin descuento.</p>",
      pt: "<p>Escolhida pela marca. Sem desconto.</p>",
    },
    handle: {
      en: "featured-tee",
      es: "remera-destacada",
      pt: "camiseta-destaque",
    },
    attributes: [{ en: "Size", es: "Talle", pt: "Tamanho" }],
    variants: [
      {
        id: 208,
        product_id: 105,
        price: "25.00",
        promotional_price: null,
        cost: "10.99",
        stock: 8,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "M", es: "M", pt: "M" }],
        sku: "FEAT-M",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [{ id: 306, product_id: 105, src: "/products/2.png", position: 1 }],
    categories: [],
    // Also tagged `nuevo`, on purpose: this is the precedence case. Everything
    // in a first drop is new, so the badge must read DESTACADO.
    tags: "nuevo,destacado,drop-1,corte-remera-oversize",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },

  {
    // The TWO BADGE FAMILIES at once, which is the case the artboard rule was
    // written for: DESTACADO sits over the photo because it describes the
    // garment, and -30% sits against the price because it describes the price.
    // 30 -> 21 is exactly 30% off, and 10% off that is the 18,90 transfer
    // price, so all three numbers can be checked by hand.
    id: 106,
    name: { en: "Promo Tee", es: "Remera en Promo", pt: "Camiseta em Promo" },
    description: {
      en: "<p>A markdown and a badge, describing two different things.</p>",
      es: "<p>Un descuento y un badge, describiendo dos cosas distintas.</p>",
      pt: "<p>Um desconto e um selo, descrevendo duas coisas diferentes.</p>",
    },
    handle: { en: "promo-tee", es: "remera-promo", pt: "camiseta-promo" },
    attributes: [{ en: "Size", es: "Talle", pt: "Tamanho" }],
    variants: [
      {
        id: 209,
        product_id: 106,
        price: "30.00",
        promotional_price: "21.00",
        cost: "10.99",
        stock: 4,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "M", es: "M", pt: "M" }],
        sku: "PROMO-M",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: 210,
        product_id: 106,
        price: "30.00",
        promotional_price: "21.00",
        cost: "10.99",
        stock: 0,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "L", es: "L", pt: "L" }],
        sku: "PROMO-L",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [{ id: 307, product_id: 106, src: "/products/4.webp", position: 1 }],
    categories: [],
    tags: "destacado,drop-1,corte-remera-oversize",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },

  {
    // NO `corte-` TAG, but sold by size. The tolerant path: no fit scale, no
    // size-table section, and the accordion below numbers 01, 02 rather than
    // leaving a hole where 02 would have been.
    id: 107,
    name: { en: "Uncut Tee", es: "Remera Sin Molde", pt: "Camiseta Sem Molde" },
    description: {
      en: "<p>No registered pattern, so the PDP says nothing about fit.</p>",
      es: "<p>Sin molde registrado, así que el PDP no dice nada del calce.</p>",
      pt: "<p>Sem molde registrado.</p>",
    },
    handle: { en: "uncut-tee", es: "remera-sin-molde", pt: "camiseta-sem-molde" },
    attributes: [{ en: "Size", es: "Talle", pt: "Tamanho" }],
    variants: [
      {
        id: 211,
        product_id: 107,
        price: "22.00",
        promotional_price: null,
        cost: "9.00",
        stock: 6,
        stock_management: true,
        weight: "2.00",
        values: [{ en: "M", es: "M", pt: "M" }],
        sku: "UNCUT-M",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    images: [{ id: 308, product_id: 107, src: "/products/3.webp", position: 1 }],
    categories: [],
    tags: "drop-1",
    published: true,
    visibility: "visible",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
] satisfies TiendanubeProduct[];
