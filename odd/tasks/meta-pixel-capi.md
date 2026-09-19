# Meta Pixel (storefront)

## Objective

Send FLESH's existing storefront funnel events to Meta through the browser
Pixel, reusing the canonical event shape GA4 already emits, so Meta Ads can
optimise and retarget against real catalogue and cart behaviour.

## Problem

The storefront measures its funnel in GA4 only. Meta Ads therefore optimises
blind: it can buy clicks but cannot learn who converts. Tiendanube's own Meta
integration does not help here — it only injects into Tiendanube-rendered pages
and only covers transaction events, so the entire catalogue and cart half of
the funnel is invisible to Meta today.

## Why now

The maintainer wants this built once and not revisited. That is satisfied by
the fan-out seam in T5 rather than by shipping a server-side client today: with
the adapter at the edge, adding a destination later is one file.

## Scope

Revised 2026-09-18 after reading Tiendanube's own Meta documentation. See
"Provider split" below.

In scope:
- Env-gated Meta Pixel bootstrap in the root layout, mirroring the GA4 config.
- A Meta adapter mapping the canonical AnalyticsEvent union to Meta standard
  event names.
- A fan-out dispatcher so call sites keep sending one domain event.
- Wiring the pixel into the root layout behind its config.

Deliberately deferred, not abandoned:
- A FLESH-owned Conversions API client. The T5 seam makes a server-side
  destination a single new adapter, so the extensibility is bought by the
  structure rather than by shipping an unused client.

Explicitly not in scope:
- Changing any GA4 behaviour. The GA4 path must stay byte-for-byte equivalent.
- A consent banner. Flagged as a constraint, not built here.
- Anything on the Tiendanube side, which is configuration rather than code.

## Provider split

Tiendanube's Pixel is installed through "Configuración → Códigos externos", so
it only injects into Tiendanube-rendered pages. This storefront is a separate
Next.js app on its own domain and is never touched by it. Their Conversions API
covers transaction events only and explicitly excludes catalogue and
product-page interactions.

| Events | Owner |
| --- | --- |
| ViewContent, AddToCart, InitiateCheckout (storefront) | FLESH, browser Pixel |
| AddPaymentInfo, Purchase (hosted checkout) | Tiendanube, Pixel + CAPI |

Consequences:
- FLESH needs no `order/paid` webhook, no CAPI client, and no server-held
  access token for this feature.
- The `event_id` deduplication problem is Tiendanube's. Their documentation
  states both channels report Purchase without duplicating metrics, which they
  can guarantee because they own both senders.
- Their CAPI runs at payment-credited timing, matching how the store is
  already configured.

Sources:
- https://ayuda.tiendanube.com/es_ES/pixel-de-facebook/como-activar-la-api-de-conversiones-de-facebook
- https://ayuda.tiendanube.com/es_AR/pixel-de-facebook/como-instalar-el-pixel-de-facebook-en-mi-tienda

## Constraints

- **Legal.** The existing no-banner approval covers GA4 analytics only. An
  advertising tracker is a different posture and is the maintainer's decision.
  Ship behind env config so it stays dark until that is settled.
- **Do not route FLESH through Meta's Conversions API Gateway.** Tiendanube
  documents its native integration as incompatible with the Gateway, warning it
  can block or contaminate conversion data. In Meta's setup wizard the correct
  choice for the FLESH property is "Solo un píxel"; CAPI is activated from
  Tiendanube's admin instead.
- **The funnel split holds.** FLESH must not emit Purchase. `ecommerce.ts`
  already enforces an allowlist rejecting hosted-checkout event names — do not
  weaken it.
- **`process.env.NEXT_PUBLIC_*` must be read as a literal member expression**
  inside the config default argument. Aliasing it behind a variable silently
  ships `undefined` to the browser while the server-rendered layout keeps
  working. See the comment in `src/modules/analytics/config.ts`.
- Project conventions: shadcn first, `--radius: 0`, Spanish shopper copy,
  English for everything else, comments explain why.

## Mode

- TDD: **strict** (session configuration). RED observed before implementation,
  then GREEN, then refactor.
- Test runner: `pnpm.cmd test` (vitest run).
- Checks per task: `pnpm.cmd test`, `pnpm.cmd typecheck`, `pnpm.cmd lint`.
- Delivery strategy: `ask-on-risk`.
- Forecast: ~350 authored changed lines, inside the ~400 delivery budget.
  Single PR, no chaining required.

## Resolved 2026-09-18

Two questions closed the same day.

1. The setup screen the maintainer showed is Meta's own wizard, not
   Tiendanube's admin.
2. Tiendanube nonetheless ships its own Conversions API, activated by
   connecting a Meta business portfolio. That makes a FLESH-owned CAPI
   unnecessary for the events that matter and removes the deduplication risk of
   two uncoordinated Purchase senders.

An earlier revision of this plan assumed Tiendanube offered no server-side path
and carried three extra tasks on that assumption. The assumption was wrong and
was corrected by reading the provider's documentation.

## Tasks

- [ ] **T1** — Meta config module: `readMetaConfig()` reading
  `NEXT_PUBLIC_META_PIXEL_ID`, pattern-validated, plus the pixel bootstrap
  snippet. Mirrors `analytics/config.ts` including the literal-env-read trap.
- [ ] **T2** — Meta adapter: map the canonical `AnalyticsEvent` union to Meta
  standard names (`view_item`→`ViewContent`, `add_to_cart`→`AddToCart`,
  `checkout_redirect`→`InitiateCheckout`). Events with no faithful Meta
  equivalent are dropped explicitly, not invented as custom events.
- [ ] **T3** — Browser transport: `fbq('track', name, params)`, env-gated and a
  no-op when unconfigured, same shape and return contract as
  `sendAnalyticsEvent`.
- [ ] **T4** — Parameter mapping: Meta's content parameters
  (`content_ids`, `contents`, `content_type`, `value`, `currency`) derived from
  the existing `AnalyticsItem[]`, without changing that type.
- [ ] **T5** — Fan-out dispatcher: one `dispatchAnalyticsEvent` feeding GA4 and
  Meta from a single call. The existing 13 call sites keep emitting domain
  events and are not rewritten per destination.
- [ ] **T6** — Wire the pixel into the root layout behind its config, alongside
  the GA4 tag, and migrate call sites to the dispatcher. Verify GA4 output is
  unchanged.

## Acceptance criteria

- With no Meta env configured, the app behaves exactly as it does today: no
  script, no network call, no thrown error.
- Every GA4 event that fires today still fires, with identical params.
- No personal data is sent to Meta from FLESH; the browser Pixel carries only
  the catalogue and cart parameters the GA4 events already carry.
- FLESH never emits Purchase.

## Progress

Feature document created 2026-09-18; scope revised the same day from nine tasks
to six after reading the provider documentation. Branch `feat/meta-pixel-capi`.

- [ ] T1 in progress.

## Next step

T1 — RED test for `readMetaConfig` and the pixel bootstrap.
