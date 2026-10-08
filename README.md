<p align="center">
  <img src="src/app/opengraph-image.png" alt="FLESH — Stronger than death" width="720" />
</p>

# FLESH

The storefront for FLESH, an Argentinian clothing brand. Products, stock and
checkout live in Tiendanube; this app is the shop window in front of them —
catalog, product pages, cart and the handoff to Tiendanube's hosted checkout.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4 and shadcn on
Base UI. Tested with Vitest and Testing Library.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The catalog needs the
Tiendanube variables below; without them there is nothing to render.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest, single run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Layout

```
src/
  app/          Routes, metadata, fonts and global styles
  components/ui shadcn design system — use it before writing a primitive
  modules/      One folder per feature, split into layers
    access-gate/     Optional password gate in front of the store
    analytics/       GA4 and Meta Pixel / Conversions API
    cart/            Cart state, storage and the checkout handoff
    catalog/         Tiendanube product fetching and mapping
    legal/           Cookie notice and returns policy
    product-detail/  Product page: gallery, purchase, accordions, SEO
    storefront/      Landing drop sections and product cards
  lib/          Cross-cutting helpers (brand, site URL, utils)
scripts/        Tiendanube maintenance scripts
test/           Shared fixtures and the test harness
```

Tests sit in a `__tests__/` folder beside the layer they cover. See
[`AGENTS.md`](AGENTS.md) for the project conventions — the design system,
square corners, Spanish copy, comments and test placement.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `TIENDANUBE_STORE_ID` | Server | Store the catalog is read from |
| `TIENDANUBE_ACCESS_TOKEN` | Server | Tiendanube API token |
| `TIENDANUBE_USER_AGENT` | Server | User agent Tiendanube requires on every API call |
| `TIENDANUBE_APP_CLIENT_SECRET` | Server | Verifies Tiendanube webhook signatures |
| `TIENDANUBE_CHECKOUT_HOST` | Server | Exact checkout hostname redirects may go to (see below) |
| `SITE_URL` | Server | Canonical origin; falls back to Vercel's production URL, then localhost |
| `ACCESS_GATE_PASSWORD` | Server | Enables the password gate; omit to leave the store open |
| `ACCESS_GATE_SECRET` | Server | Signs the gate's access cookie; required when the password is set |
| `ACCESS_GATE_MESSAGE` | Server | Optional message shown on the gate |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Client | Enables GA4; omit to disable analytics |
| `NEXT_PUBLIC_META_PIXEL_ID` | Client | Enables the Meta Pixel |
| `META_CAPI_ACCESS_TOKEN` | Server | Meta Conversions API token |
| `META_GRAPH_API_VERSION` | Server | Graph API version for Conversions API calls; has a default |

Changing any of them requires a new build and deployment.

## Product custom fields

`colourway`, `fit` and `size_chart` are Tiendanube custom fields the admin
cannot edit. [`scripts/custom-fields.mjs`](scripts/custom-fields.mjs) is the
only writer; the `product-fields` skill in `.claude/skills/` drives it.

## Analytics rollout

The storefront sends pre-checkout ecommerce events directly to GA4. Tiendanube
owns the hosted checkout and purchase funnel, so this app MUST NOT emit
`begin_checkout`, shipping, payment, or `purchase` events.

`NEXT_PUBLIC_GA_MEASUREMENT_ID` enables the Google tag when it matches
`G-...`. `TIENDANUBE_CHECKOUT_HOST` takes a bare hostname, for example
`checkout.example.com`; URLs, paths, wildcard domains, and ports are rejected.

Use a separate GA4 web data stream and measurement ID for every deployed
environment. Never reuse the production ID in preview deployments.

### Cross-domain continuity

In the production GA4 web stream, configure cross-domain measurement for the
storefront hostname and the exact Tiendanube checkout hostname. The checkout
handoff is a user-clicked HTTPS anchor so the Google tag can decorate it with
the linker parameter; the application does not manufacture linker values.

Before release, use Tag Assistant and GA4 DebugView to confirm:

1. `page_view` fires once on the first pathname and once per pathname change,
   but not for query-only filter changes.
2. Catalog, product, and cart interactions emit only the allowlisted events:
   `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `view_cart`, and
   `remove_from_cart`.
3. The checkout link emits `checkout_redirect` once and carries the decorated
   linker parameter to the configured Tiendanube host.
4. Ecommerce payloads contain no buyer name, email, address, cookie value, or
   other PII. Variants without a SKU keep `item_name` and omit `item_id`.
5. Tiendanube emits the downstream paid-order `purchase` event exactly once;
   the storefront does not duplicate it.

Do not release until all five checks pass against the production stream and
checkout host. To roll analytics back without reverting storefront code,
remove `NEXT_PUBLIC_GA_MEASUREMENT_ID` and rebuild. If checkout-host validation
blocks a legitimate provider URL, restore the last known exact hostname and
rebuild; never relax the guard to a suffix or wildcard match.
