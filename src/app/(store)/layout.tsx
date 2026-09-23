import type { ReactNode } from 'react';
import Script from 'next/script';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { BackgroundPlate } from '@/components/shared/background-plate';
import { SheetBackgroundPreload } from '@/components/ui/sheet-background';
import { SkullsBackgroundPreload } from '@/components/ui/skulls-background';
import { CookieNotice } from '@/modules/legal/cookie-notice';
import {
  googleTagBootstrap,
  googleTagSource,
  readAnalyticsConfig,
} from '@/modules/analytics/config';
import {
  metaPixelBootstrap,
  metaPixelSource,
  readMetaConfig,
} from '@/modules/analytics/meta/config';
import { PageViewTracker } from '@/modules/analytics/page-view-tracker';
import { toCartCatalog } from '@/modules/cart/domain/catalog-projection';
import { CartProvider } from '@/modules/cart/state/cart-context';
import { getPricingPolicy, getPurchasableProducts } from '@/modules/catalog';

// `/acceso` sits outside this group on purpose — it is excluded from the
// proxy's access gate, so anything this layout mounts (in particular the
// cart's Server Action references) would otherwise ship to and be callable
// from an ungated page. Splitting it out here also spares the gate page the
// catalog load below, the video plate it paints over, and trackers that must
// not run without the cookie notice.
export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  const analytics = readAnalyticsConfig();
  const meta = readMetaConfig();
  // The catalog is resolved HERE and projected into plain data, because the
  // cart cannot reach it from the other side. `@/modules/catalog` re-exports
  // `server-only` values, so a client component importing it is a build error —
  // which makes this layout the one place both halves are reachable at once.
  //
  // `toCartCatalog` narrows a `ProductView` to what the cart actually needs:
  // no `descriptionHtml`, no axes, no tags. What crosses the boundary below is
  // that projection and a number, never a function.
  //
  // `getPurchasableProducts()`, not `getProducts()`: the cart must know every
  // variant a shopper can legitimately add, and that is a purchasability
  // question, not a merchandising one. An unlisted colourway is deliberately
  // excluded from `getProducts()` (the visible-only discovery set), but it is
  // still reachable and fully purchasable from its own PDP — building this
  // catalog off `getProducts()` left such a variant out of the index, so
  // `AddedToast` rendered empty after adding it and `reconcile` dropped the
  // line as an unknown variant on reload.
  //
  // Named cost, not a free lunch: this layout is now a catalog consumer.
  // Today `getProducts` is a synchronous fixture scan, so this is free. Against
  // a live Tiendanube source it becomes a per-request call on EVERY store
  // route, under a leaky-bucket rate limit, and caching the snapshot is real
  // work nobody has done yet. The `await`s are here for that day.
  const catalog = toCartCatalog(await getPurchasableProducts());
  const { transferRateBp } = await getPricingPolicy();

  return (
    <>
      {/* No `<head>` to render into here — this is a nested layout, not the
          root. React 19 hoists `<link rel=preload>` elements to `<head>`
          wherever they render, which is what makes emitting them as plain
          children of the fragment work. */}
      {/* The cart is available on every store route, so its first open should
          not expose the plain panel while this decorative plate is still
          downloading. The catalogue keeps its separate viewport-bounded
          policy; this preload pays only for the shared sheet asset. */}
      <SheetBackgroundPreload />
      {/* Same bargain as the sheet plate above, for the toast that
          announces an add to cart: it can appear on any store route, and its
          first appearance should not be a bare panel. */}
      <SkullsBackgroundPreload />
      {/* Here and not in a page: a layout survives client-side navigation,
          a page does not. Rendered per page, the plate's <video> was
          remounted on every route change and restarted from the first
          frame. Each page still draws its own `PageScrim` over it, which
          is the only part of the plate the artboards vary. */}
      <BackgroundPlate />
      <NuqsAdapter>
        {/* Inside the adapter, not outside it: the cart's own UI is the
            next thing to be built, and a drawer whose open state one day
            belongs in the URL would otherwise be the one subtree that
            cannot reach nuqs. Nothing is paid for the ordering. */}
        <CartProvider catalog={catalog} transferRateBp={transferRateBp}>
          {children}
        </CartProvider>
      </NuqsAdapter>
      {/* Outside the adapter and outside the cart: this notice belongs to
          no route and reads no state either owns. In the layout rather
          than a page for the ordinary reason — it must survive a
          client-side navigation, or dismissing it on the landing would
          bring it straight back on the PDP. */}
      <CookieNotice />
      {/* One tracker for both destinations, so it has to outlive either one
          being switched off: gating it on GA4 alone would leave a
          Meta-only deployment without a single pageview. */}
      {(analytics || meta) && <PageViewTracker />}
      {analytics && (
        <>
          <Script
            src={googleTagSource(analytics.measurementId)}
            strategy='afterInteractive'
          />
          <Script id='ga4-bootstrap' strategy='afterInteractive'>
            {googleTagBootstrap(analytics.measurementId)}
          </Script>
        </>
      )}
      {meta && (
        <>
          <Script id='meta-pixel-bootstrap' strategy='afterInteractive'>
            {metaPixelBootstrap(meta.pixelId)}
          </Script>
          <Script src={metaPixelSource()} strategy='afterInteractive' />
        </>
      )}
    </>
  );
}
