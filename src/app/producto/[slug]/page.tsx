import { notFound } from "next/navigation";
import { BackgroundPlate } from "@/components/shared/background-plate";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { getProductByHandle } from "@/modules/catalog";
import { ProductGallery } from "@/modules/product-detail/gallery/product-gallery";
import { PurchasePanel } from "@/modules/product-detail/purchase/purchase-panel";

/** PDP artboard scrim: 70% black, one step lighter than the landing's. */
const PDP_SCRIM = "#000000B3";

/**
 * The product detail page.
 *
 * Async for the same reason the landing is: `CatalogPort` allows a promise and
 * the live Tiendanube client will return one, so awaiting here keeps that swap
 * inside the catalog module.
 *
 * Nothing on this page reads `searchParams`. The variant selection lives in
 * the query string, but only the client-side panel reads it — which is what
 * keeps the SEO-relevant shell statically renderable instead of opting the
 * whole route into dynamic rendering at request time.
 */
export default async function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const product = await getProductByHandle(slug);

  if (!product) {
    notFound();
  }

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
        <div className="md:min-w-0 md:basis-160">
          <ProductGallery images={product.images} title={product.title} />
        </div>

        {/* The 40px nudge lines the panel up with the GARMENT rather than with
            the gallery box. The stage is a fixed 722px tall and the photo is
            `object-contain`, so a portrait shot letterboxes and its visible top
            edge sits about that far below the box it lives in. */}
        <div className="flex w-full flex-col gap-6 md:min-w-0 md:basis-150 md:pt-10">
          <h1 className="font-display text-2xl leading-[1.05] text-primary md:text-[45px]">
            {product.title}
          </h1>

          <PurchasePanel
            // Only the variant matrix crosses the boundary — the panel has no
            // use for `descriptionHtml`, which is already being sent once for
            // the block below.
            product={{ axes: product.axes, variants: product.variants }}
            defaultVariantId={product.defaultVariantId}
          />

          {/* The artboard files this copy inside the first accordion, which
              PR8b builds. It renders plainly here so the page is not shipped
              with its description missing; PR8b moves this node, it does not
              add a second one.

              `descriptionHtml` is a `SafeHtml`, and only `catalog/lib/sanitize`
              can mint one — that brand is what makes this the single call site
              of `dangerouslySetInnerHTML` a safe one. */}
          <div
            className="font-sans text-xs leading-relaxed text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
