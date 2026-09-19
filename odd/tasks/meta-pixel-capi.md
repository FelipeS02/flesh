# Meta Pixel + Conversions API (storefront)

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

- [x] **T1** — Meta config module: `readMetaConfig()` reading
  `NEXT_PUBLIC_META_PIXEL_ID`, pattern-validated, plus the pixel bootstrap
  snippet. Mirrors `analytics/config.ts` including the literal-env-read trap.
- [x] **T2** — Meta adapter (absorbed the former T4, parameter mapping: the
  two were one file and splitting them was an artificial cut). Map the canonical `AnalyticsEvent` union to Meta
  standard names (`view_item`→`ViewContent`, `add_to_cart`→`AddToCart`,
  `checkout_redirect`→`InitiateCheckout`). Events with no faithful Meta
  equivalent are dropped explicitly, not invented as custom events.
- [x] **T3** — Browser transport: `fbq('track', name, params)`, env-gated and a
  no-op when unconfigured, same shape and return contract as
  `sendAnalyticsEvent`.
- [x] **T5** — Fan-out dispatcher: one `dispatchAnalyticsEvent` feeding GA4 and
  Meta from a single call. The existing 13 call sites keep emitting domain
  events and are not rewritten per destination.
- [x] **T6** — Wire the pixel into the root layout behind its config, alongside
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
to six after reading the provider documentation, then to five when T4 was
absorbed into T2. Branch `feat/meta-pixel-capi`.

- [x] T1 — commit `7190926`. 8 new tests. Full suite 818 passed (103 files),
  typecheck clean, lint 6 warnings all pre-existing (PageScrim/Footer unused,
  3x exhaustive-deps in product-gallery.tsx) and matching the known baseline.
- [x] T2 — commit `d22cb58`. 6 new tests, suite 824 passed (104 files).
- [x] T3 — 5 new tests, suite 829 passed (105 files).
- [x] T5 — 6 new tests. Dispatcher isolates destinations: a throwing pixel can
  no longer take down a GA4 event that has worked for months.
- [x] T6 — call sites migrated and the pixel wired into the layout. Suite 835
  passed (106 files), typecheck clean, lint 6 warnings all pre-existing,
  `pnpm build` exit 0.

Migration note: the seven suites that mocked `sendAnalyticsEvent` were
repointed to `dispatchAnalyticsEvent` FIRST, which turned 12 tests red across
7 files and mapped the migration surface exactly before a line of production
code moved.

The barrel no longer exports `sendAnalyticsEvent`. Reaching a single
destination from outside the module is now a type error, which is the point:
the fan-out is not opt-in.

All six tasks are complete. What remains is not code:

- Set `NEXT_PUBLIC_META_PIXEL_ID`. Until then the storefront is byte-for-byte
  unchanged.
- Settle the advertising-tracker consent question before enabling it.
- In Meta’s wizard choose "Solo un píxel" for the FLESH property; activate
  CAPI from Tiendanube’s admin instead.
- Verify the domain in Business Manager, and confirm in Events Manager that
  Tiendanube’s AddToCart does not collide with the storefront’s.

## Next step

Phase 1 is code-complete and awaiting its pull request. Phase 2 begins below.

---

# Phase 2 — Conversions API for the checkout handoff

Added 2026-09-19. Phase 1 deferred a FLESH-owned Conversions API on the
grounds that it would recover events without recovering identity. The
maintainer identified the case that defeats that reasoning.

## Why the deferral was reversed

Each party holds half of what Meta needs, and only one place holds both:

- The **storefront** receives `fbclid` in the landing URL from a Meta ad, but
  has no buyer identity until the checkout form is submitted.
- **Tiendanube** holds the buyer's email in the draft order, but never saw the
  `fbclid` — that parameter arrived on a different domain.
- **`startTiendanubeCheckout`** resolves and validates the buyer *before*
  calling Tiendanube, so at that moment the server holds the email, the name,
  the click id, the pixel cookie, the IP and the user agent at once.

Tiendanube's server-side events therefore carry identity but, by inference, no
ad-click attribution. Meta learns who bought and not which ad produced them,
which is the association the optimiser actually trains on.

**Unverified inference:** that Tiendanube does not forward `_fbc`. Confirm in
Events Manager once traffic is real, by inspecting the parameters their
Purchase arrives with. If they do forward it, this phase loses most of its
value and should be reconsidered rather than defended.

## Design decision: InitiateCheckout moves to the server

Phase 1 mapped `checkout_redirect` to a browser `InitiateCheckout`. Phase 2
removes that mapping and sends the event from the server instead.

The reason is that deduplicating the two would otherwise require threading a
shared `event_id` from the server, through the checkout outcome, into the
browser dispatcher — polluting a deliberately vendor-agnostic seam for a
browser event that carries strictly less than its server twin. The server
event has the email, the click id and the request metadata; the browser event
has none of them and adds nothing the server one lacks.

Redundancy exists to cover the browser's fragility. A server event we control
does not have that fragility, so there is nothing to cover.

Consequence: no shared `event_id` is needed anywhere in this feature, and no
event is ever sent twice.

## Tasks

- [x] **T7** — Click-id capture. Read `fbclid` from the request in `proxy.ts`
  (Next 16 renamed `middleware` to `proxy`; verified in
  `node_modules/next/dist/docs`) and persist Meta's `_fbc` format
  (`fb.1.<timestamp>.<fbclid>`) in a first-party cookie, following the
  injectable `CookieStore` pattern already used by `pending-order.cookie.ts`.
- [ ] **T8** — User data: normalise and SHA-256 hash email, first name and last
  name per Meta's documented rules, and assemble the `user_data` payload with
  `fbc`, `fbp`, client IP and user agent. No raw personal data leaves this
  module unhashed.
- [ ] **T9** — CAPI client: POST to the Graph API events endpoint, env-gated on
  a server-held access token, with the timeout and injectable `fetchImpl`
  pattern `checkout.tiendanube.ts` already uses. The token never appears in a
  log line or an error `cause`.
- [ ] **T10** — Emit `InitiateCheckout` from `startTiendanubeCheckout`, and
  remove the browser mapping. A CAPI failure must never change the shopper's
  checkout outcome.

## Acceptance criteria

- With no access token configured, checkout behaves exactly as it does today
  and no Meta request is attempted.
- A CAPI failure, timeout or rejection never changes the checkout outcome the
  shopper receives.
- No unhashed email or name is ever sent, logged, or attached to an error.
- The access token never reaches the client bundle.
- Exactly one `InitiateCheckout` per checkout submission, from one channel.

## Constraints carried forward

The consent question now covers storing a click id in a first-party cookie and
sending hashed personal data to Meta. That is one decision for the maintainer,
not two, and it still gates enabling any of this in production.

## Progress

Branch `feat/meta-capi-checkout`, chained on `feat/meta-pixel-capi`.

- [x] T7 — 11 new tests (7 pure, 4 through the proxy). Suite 846 passed (107
  files), typecheck clean, lint 6 pre-existing warnings, build compiles and
  the Proxy still registers.
- [ ] T8 in progress.

Incident: proxy.ts was overwritten before being read. src/proxy.ts already
existed and enforces the access gate; the earlier search looked only for
middleware.* and missed it. Restored from HEAD with no loss, and the capture
was then added as a wrapper that leaves the gate logic byte-identical inside
an extracted gate() function.

## Next step

T8 — RED test for hashed user data.
