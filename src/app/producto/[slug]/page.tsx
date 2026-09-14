import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageScrim } from '@/components/shared/background-plate';
import { Footer } from '@/components/shared/footer';
import { Header } from '@/components/shared/header';
import { siteUrl } from '@/lib/site-url';
import {
  colourwayLinks,
  getColourwayIndex,
  getProductByHandle,
  getProducts,
} from '@/modules/catalog';
import { InfoAccordions } from '@/modules/product-detail/accordions/info-accordions';
import { ProductGallery } from '@/modules/product-detail/gallery/product-gallery';
import { StageMetrics } from '@/modules/product-detail/gallery/stage-metrics';
import { FitScale } from '@/modules/product-detail/garment/fit-scale';
import { ColourwaySelector } from '@/modules/product-detail/purchase/colourway-selector';
import {
  PurchasePanel,
  PurchasePanelFallback,
} from '@/modules/product-detail/purchase/purchase-panel';
import {
  productJsonLd,
  serializeJsonLd,
} from '@/modules/product-detail/seo/product-jsonld';
import { productMetadata } from '@/modules/product-detail/seo/product-metadata';
import { productState } from '@/modules/storefront/product-state';
import { StateBadge } from '@/modules/storefront/state-badge';
import BarbedWireSeparator from '@/components/shared/barbed-wire-separator';

/** PDP artboard scrim: 70% black, one step lighter than the landing's. */
const PDP_SCRIM = '#00000070';

/**
 * Prerenders every product at build time instead of resolving one per request.
 *
 * The catalogue is a fixed drop, so enumerating it is cheap and the crawler
 * gets static HTML. It stays correct after the Tiendanube swap because it goes
 * through the same `CatalogPort` the page does.
 *
 * The listing is NOT the whole answer. A design's secondary colours are
 * `unlisted` so the grid draws one card per design, which means `getProducts`
 * filters out the exact pages every swatch row links to â€” they would fall back
 * to on-demand rendering while the colour they sit beside is static. What gets
 * prerendered is therefore what is REACHABLE: the listing plus every colourway
 * in it.
 */
export async function generateStaticParams() {
  const [products, colourways] = await Promise.all([
    getProducts(),
    getColourwayIndex(),
  ]);

  const slugs = new Set(products.map((product) => product.slug));
  for (const links of colourways.values()) {
    for (const link of links) {
      slugs.add(link.slug);
    }
  }

  return [...slugs].map((slug) => ({ slug }));
}

/**
 * Per-product metadata: title, description, canonical and the share card.
 *
 * A missing product returns bare metadata rather than throwing â€” the page
 * component below is what owns the 404, and duplicating that decision here
 * would mean two places deciding what "not found" means.
 */
export async function generateMetadata({
  params,
}: PageProps<'/producto/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductByHandle(slug);

  return product ? productMetadata(product) : {};
}

/**
 * The product detail page.
 *
 * Async for the same reason the landing is: `CatalogPort` allows a promise and
 * the live Tiendanube client will return one, so awaiting here keeps that swap
 * inside the catalog module.
 *
 * Nothing on this page reads `searchParams`. The variant selection lives in
 * the query string, but only the client-side panel reads it â€” and it reads it
 * inside a `<Suspense>` boundary, which is what lets the rest of the route
 * prerender to static HTML instead of resolving per request.
 */
export default async function ProductPage({
  params,
}: PageProps<'/producto/[slug]'>) {
  const { slug } = await params;
  // Two independent reads against the live API â€” the product and the colourway
  // custom field â€” so they go out together rather than one after the other.
  const [product, colourways] = await Promise.all([
    getProductByHandle(slug),
    getColourwayIndex(),
  ]);

  if (!product) {
    notFound();
  }

  // One badge, decided in one place â€” stock outranks any tag the merchant
  // wrote, because being new is not news about a garment you cannot buy.
  const state = productState(product);

  // Resolved once. The colour row is drawn twice on mobile — beside the title
  // and again on the fixed widget — and both draw the same list.
  const links = colourwayLinks(colourways, product);

  return (
    // `relative` with no fixed height: the plate covers the whole DOCUMENT
    // here, which on the PDP artboard is 1708px â€” taller than the viewport, so
    // `h-screen` would leave the page's lower half unpainted.
    // The vertical rhythm moved off this wrapper and onto `<main>`. A single
    // `gap-10` here spaced header-to-main and main-to-footer identically,
    // and mobile now needs those two to differ: the gallery has to start
    // flush under the header band for its one-screenful height to be true,
    // while the footer still wants air above it.
    <div className='relative flex min-h-screen flex-1 flex-col px-4 md:px-0'>
      {/* Structured data, not content: this is what turns the listing into a
          price-and-stock rich result. It is written absolute because Next
          resolves `metadataBase` for metadata fields only â€” a JSON-LD block
          reaches the crawler byte for byte, with no base to resolve against. */}
      <script
        type='application/ld+json'
        // Escaped by `serializeJsonLd`, which is the only reason this is safe:
        // merchant copy can contain a literal `</script>`.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productJsonLd(product, siteUrl())),
        }}
      />
      <PageScrim scrim={PDP_SCRIM} />
      <Header />

      {/* Renders nothing. It measures the sticky band and the fixed widget
          and publishes their heights, which is what lets the mobile gallery
          be exactly one screenful minus both without either number being
          written down twice. */}
      <StageMetrics />

      {/* No gap on mobile between the header band and the gallery, and none
          between the gallery and what follows: the stage is sized to exactly
          one screenful minus that band and the fixed widget, and a 40px gap
          on either side of it is 40px the arithmetic did not account for.
          Desktop keeps the gap it always had. */}
      <main className='mx-auto mb-10 flex w-full flex-1 flex-col md:mt-10 md:flex-row md:items-start md:gap-14 md:px-18'>
        {/* The artboard's 640 / 600 split, expressed as flex BASES rather than
            widths: they add up to 1296 only at a 1440 viewport, and every
            narrower desktop has to take the difference out of both columns
            proportionally instead of overflowing. */}
        {/* Sticky on desktop only. The panel column is the taller of the two
            and the one worth scrolling â€” the garment should stay in view while
            you read its measurements, not scroll away above them. `self-start`
            is what makes it work: a stretched flex item is as tall as the row,
            and an element that tall has nothing left to stick within.

            Mobile stacks the two columns, so there is nothing to stay beside. */}
        <div className='md:sticky md:top-10 md:min-w-0 md:flex-1 md:self-start md:basis-160'>
          <ProductGallery
            images={product.images}
            title={product.title}
            // Resolved here and passed as a rendered node, so the tag rules and
            // the badge copy stay on the server rather than crossing into the
            // gallery's client bundle.
            badge={<StateBadge state={state} />}
            dimmed={state === 'soldOut'}
          />
        </div>

        {/* The 40px nudge lines the panel up with the GARMENT rather than with
            the gallery box. The stage is a fixed 722px tall and the photo is
            `object-contain`, so a portrait shot letterboxes and its visible top
            edge sits about that far below the box it lives in. */}
        <div className='relative flex w-full flex-col gap-3 pt-6 md:min-w-0 md:basis-150 md:pt-10'>
          {/* The marker the fixed widget watches, and nothing else. It is
              ABSOLUTE so it stays outside this column's flex flow — as a
              normal child it would take a `gap-3` of its own and push the
              title down by 12px to mark a position it is only supposed to
              report.

              It sits here rather than on the column itself because an
              `IntersectionObserver` reports crossings of a box: the column is
              taller than the half-viewport the rule measures against, so it
              is already intersecting before its top edge reaches the middle
              and still intersecting after. A zero-height marker crosses
              cleanly, once, in each direction. */}
          <div data-pdp-panel-top aria-hidden='true' className='absolute inset-x-0 top-0 h-0' />

          <h1 className='font-display text-2xl leading-[1.05] text-primary md:text-[45px]'>
            {product.title}
          </h1>

          <BarbedWireSeparator className='mt-1'/>

          {/* The one dynamic slot on an otherwise prerendered page. Reading
              the query string during a static build is a CSR bailout, so the
              reader has to sit inside a boundary, and the fallback renders the
              DEFAULT selection rather than a skeleton, which is what keeps the
              price in the prerendered HTML.

              The colourway selector is passed IN as an element rather than
              rendered here, because it has to appear between the price and the
              variant axes, which are both inside the panel. Built here, it
              stays server-rendered: choosing a colour LEAVES this page, so it
              is navigation, not state, and nothing in it reads the query
              string. Both branches get their own element so the fallback and
              the hydrated panel render identical markup. */}
          <Suspense
            fallback={
              <PurchasePanelFallback
                product={{ axes: product.axes, variants: product.variants }}
                productId={product.id}
                defaultVariantId={product.defaultVariantId}
                colourwaySelector={
                  <ColourwaySelector links={links} currentSlug={product.slug} />
                }
                colourways={links}
                currentSlug={product.slug}
              />
            }
          >
            <PurchasePanel
              // Only the variant matrix crosses the boundary â€” the panel has no
              // use for `descriptionHtml`, which is already being sent once for
              // the block below.
              product={{ axes: product.axes, variants: product.variants }}
              productId={product.id}
              defaultVariantId={product.defaultVariantId}
              colourwaySelector={
                <ColourwaySelector links={links} currentSlug={product.slug} />
              }
              // Only the widget uses these; the panel hands them straight
              // through. They are plain link data, not the catalogue.
              colourways={links}
              currentSlug={product.slug}
            />
          </Suspense>

          {product.fit && <FitScale fit={product.fit} />}

          {/* The description moved INTO the first accordion rather than being
              duplicated beside it â€” the artboard always filed it there, and
              PR8a only rendered it plainly so the page never shipped without
              it. Same node, new home. */}
          <InfoAccordions
            product={{
              descriptionHtml: product.descriptionHtml,
              sizeChart: product.sizeChart,
            }}
          />
        </div>
      </main>
    </div>
  );
}
