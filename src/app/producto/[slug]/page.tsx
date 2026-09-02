import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackgroundPlate } from "@/components/shared/background-plate";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { getProductByHandle, getProducts } from "@/modules/catalog";
import { InfoAccordions } from "@/modules/product-detail/accordions/info-accordions";
import { ProductGallery } from "@/modules/product-detail/gallery/product-gallery";
import { findGarmentCut } from "@/modules/product-detail/garment/cuts";
import { FitScale } from "@/modules/product-detail/garment/fit-scale";
import {
  PurchasePanel,
  PurchasePanelFallback,
} from "@/modules/product-detail/purchase/purchase-panel";
import { productMetadata } from "@/modules/product-detail/seo/product-metadata";
import { productState } from "@/modules/storefront/product-state";
import { StateBadge } from "@/modules/storefront/state-badge";

/** PDP artboard scrim: 70% black, one step lighter than the landing's. */
const PDP_SCRIM = "#000000B3";

/**
 * Prerenders every product at build time instead of resolving one per request.
 *
 * The catalogue is a fixed drop, so enumerating it is cheap and the crawler
 * gets static HTML. It stays correct after the Tiendanube swap because it goes
 * through the same `CatalogPort` the page does.
 */
export async function generateStaticParams() {
  const products = await getProducts();

  return products.map((product) => ({ slug: product.slug }));
}

/**
 * Per-product metadata: title, description, canonical and the share card.
 *
 * A missing product returns bare metadata rather than throwing — the page
 * component below is what owns the 404, and duplicating that decision here
 * would mean two places deciding what "not found" means.
 */
export async function generateMetadata({
  params,
}: PageProps<"/producto/[slug]">): Promise<Metadata> {
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
 * the query string, but only the client-side panel reads it — and it reads it
 * inside a `<Suspense>` boundary, which is what lets the rest of the route
 * prerender to static HTML instead of resolving per request.
 */
export default async function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const product = await getProductByHandle(slug);

  if (!product) {
    notFound();
  }

  // Garment content, resolved on the server from the product's `corte-` tag.
  // A product with no cut — or two — renders no fit scale at all rather than
  // a guessed one.
  const cut = findGarmentCut(product);

  // One badge, decided in one place — stock outranks any tag the merchant
  // wrote, because being new is not news about a garment you cannot buy.
  const state = productState(product);

  return (
    // `relative` with no fixed height: the plate covers the whole DOCUMENT
    // here, which on the PDP artboard is 1708px — taller than the viewport, so
    // `h-screen` would leave the page's lower half unpainted.
    <div className="relative flex min-h-screen flex-1 flex-col gap-10 px-4 md:px-0">
      <BackgroundPlate scrim={PDP_SCRIM} />
      <Header />

      <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-10 md:flex-row md:items-start md:gap-14 md:px-18">
        {/* The artboard's 640 / 600 split, expressed as flex BASES rather than
            widths: they add up to 1296 only at a 1440 viewport, and every
            narrower desktop has to take the difference out of both columns
            proportionally instead of overflowing. */}
        {/* Sticky on desktop only. The panel column is the taller of the two
            and the one worth scrolling — the garment should stay in view while
            you read its measurements, not scroll away above them. `self-start`
            is what makes it work: a stretched flex item is as tall as the row,
            and an element that tall has nothing left to stick within.

            Mobile stacks the two columns, so there is nothing to stay beside. */}
        <div className="md:sticky md:top-10 md:min-w-0 md:basis-160 md:self-start">
          <ProductGallery
            images={product.images}
            title={product.title}
            // Resolved here and passed as a rendered node, so the tag rules and
            // the badge copy stay on the server rather than crossing into the
            // gallery's client bundle.
            badge={<StateBadge state={state} />}
            dimmed={state === "soldOut"}
          />
        </div>

        {/* The 40px nudge lines the panel up with the GARMENT rather than with
            the gallery box. The stage is a fixed 722px tall and the photo is
            `object-contain`, so a portrait shot letterboxes and its visible top
            edge sits about that far below the box it lives in. */}
        <div className="flex w-full flex-col gap-6 md:min-w-0 md:basis-150 md:pt-10">
          <h1 className="font-display text-2xl leading-[1.05] text-primary md:text-[45px]">
            {product.title}
          </h1>

          {/* The one dynamic slot on an otherwise prerendered page. Reading
              the query string during a static build is a CSR bailout, so the
              reader has to sit inside a boundary — and the fallback renders
              the DEFAULT selection rather than a skeleton, which is what keeps
              the price in the prerendered HTML. */}
          <Suspense
            fallback={
              <PurchasePanelFallback
                product={{ axes: product.axes, variants: product.variants }}
                defaultVariantId={product.defaultVariantId}
              />
            }
          >
            <PurchasePanel
              // Only the variant matrix crosses the boundary — the panel has no
              // use for `descriptionHtml`, which is already being sent once for
              // the block below.
              product={{ axes: product.axes, variants: product.variants }}
              defaultVariantId={product.defaultVariantId}
            />
          </Suspense>

          {cut && <FitScale fit={cut.fit} />}

          {/* The description moved INTO the first accordion rather than being
              duplicated beside it — the artboard always filed it there, and
              PR8a only rendered it plainly so the page never shipped without
              it. Same node, new home. */}
          <InfoAccordions
            product={{ descriptionHtml: product.descriptionHtml, axes: product.axes }}
            cut={cut}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
