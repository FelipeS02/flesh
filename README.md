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
| `SUPABASE_URL` | Server | Supabase project URL for newsletter storage |
| `SUPABASE_SECRET_KEY` | Server | Supabase secret key (bypasses RLS); never `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | Server | Resend API key for newsletter and restock emails |
| `EMAIL_FROM` | Server | Sender, e.g. `FLESH <novedades@flesh.ar>`; the domain must be verified in Resend (DNS records) before production sends |
| `EMAIL_REPLY_TO` | Server | Optional reply-to address |
| `CRON_SECRET` | Server | Bearer secret Vercel Cron sends to `/api/cron/keep-alive`; unset rejects every call |
| `META_GRAPH_API_VERSION` | Server | Graph API version for Conversions API calls; has a default |

Changing any of them requires a new build and deployment.

## Sending a campaign

One-off emails (a new drop, an announcement) are sent from your machine with
`pnpm campaign`. Each campaign is one disposable file; there is no admin UI.

1. **Create the template.** Write
   `src/modules/newsletter/emails/campaigns/<slug>.tsx`; the last sent campaign
   in git history is the quickest start (`git show
   aab2dc4:src/modules/newsletter/emails/campaigns/example-drop.tsx`). It default-exports
   the component (props `{ baseUrl, unsubscribeUrl }`) and exports `subject`
   and `previewText`. The slug is lowercase letters, digits and hyphens.
2. **Preview it.** `pnpm email` serves the templates and campaigns on
   http://localhost:3001.
3. **Dry run.** `pnpm campaign <slug>` prints the Supabase host, sender,
   subject, active subscriber count, batch count and estimated time, renders one
   sample, and sends nothing.
4. **Test send.** `pnpm campaign <slug> --to you@example.com` sends exactly one
   real email to that address (its unsubscribe link is a dummy).
5. **Send.** `pnpm campaign <slug> --send` asks you to type the slug, then
   mails every active subscriber in batches of 100, about two batches per second.

Check the printed Supabase host and sender before step 5: the script reads
`.env.local`, which may point at production. If a run stops, it prints the batch
to resume from; re-run with `--from-batch <n>` the same day. Each batch carries
the idempotency key `campaign/<slug>/<n>`, which Resend remembers for about 24
hours, so batches it already accepted are not mailed twice.

Campaign files are disposable: delete `<slug>.tsx` after sending, git history
keeps it. Images are loaded from the site, so a campaign sent from your machine
needs `SITE_URL` set to an origin that already serves them.

## Testing a notice email in a real inbox

The launch and restock emails are sent by webhook dispatches that only run on
a deployment. To check a template change in Gmail or Apple Mail first, mail one
copy to yourself:

```sh
pnpm email:test launch --to you@example.com --origin https://dev.flesh.ar
pnpm email:test restock --to you@example.com
```

The markup comes from your checkout; the product is the template's preview
fixture. Images and the font load from `--origin` (default `SITE_URL`), which
must be a deployed site serving `public/email/`: Gmail fetches images through
its proxy and cannot reach localhost, so the script refuses it. The subject is
prefixed `[TEST]`.

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
