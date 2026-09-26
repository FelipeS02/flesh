import Image from "next/image";
import Link from "next/link";
import FleshLogotype from "@/components/shared/flesh-logotype";
import { Button } from "@/components/ui/button";

/**
 * Where the drop lives, by the same anchor the header nav and the empty cart
 * use — there is no catalogue route, and a second answer to "where are the
 * clothes" is how the two drift apart.
 */
const CATALOG_HREF = "/#catalogo";

/**
 * What `notFound()` in the PDP renders: a slug that names no product, which in
 * practice is a piece that sold out of the listing or a link that outlived it.
 *
 * The status is a real 404 only because nothing above this segment streams.
 * Add a `loading.tsx` on the way here and the headers go out before
 * `notFound()` runs: Next answers 200 with this UI. It still injects
 * `noindex`, so search is safe, but analytics and uptime checks see a success.
 *
 * The one way out is the drop, not home: someone who came for a garment is
 * best served by the others.
 */
export default function ProductNotFound() {
  return (
    // `bg-background` on purpose: this renders inside the `(store)` layout, so
    // the sitewide video is still playing underneath, and the artboard is flat
    // black — the skull over a moving plate stops reading as one image.
    <main className="relative flex min-h-svh w-full flex-col justify-end overflow-hidden bg-background px-6 pb-10 md:justify-center md:px-40 md:pb-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* SQUARE, like on the gate, so the 2362×2362 source is never cropped
            by its own box — the crop is the viewport edge, which is the point:
            the skull is too big for the page. */}
        <div className="absolute top-10 left-1/2 aspect-square w-165 -translate-x-1/2 opacity-40 md:top-1/2 md:-right-75 md:left-auto md:w-295 md:translate-x-0 md:-translate-y-1/2 md:opacity-45">
          <Image
            src="/password-illustration.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 1180px, 660px"
            className="object-contain"
          />
        </div>
        {/* Clears a window for the skull and returns to solid black where the
            copy sits, so the text never has to compete with the artwork's
            highlights. Mobile fades top and bottom (wordmark above, copy
            below); desktop fades toward the left column. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--background)_0%,transparent_20%,transparent_40%,var(--background)_66%)] md:bg-[linear-gradient(to_right,var(--background)_35%,transparent_75%)]" />
      </div>

      <Link
        href="/"
        aria-label="FLESH inicio"
        className="absolute top-10 left-1/2 -translate-x-1/2 md:top-11"
      >
        <FleshLogotype className="w-20 md:w-40 " />
      </Link>

      <div className="relative flex flex-col">
        <h1 className="font-display text-[56px] leading-[0.95] text-foreground md:text-[88px]">
          Esta pieza ya <br /> no está disponible
        </h1>
        <p className="mt-4 max-w-104 font-sans text-[13px] leading-relaxed tracking-control text-muted-foreground uppercase md:mt-6">
          Se agotó, salió del drop o el link está roto.
        </p>
        <Button
          asChild
          className="mt-7 h-16 w-full font-display text-xl hover:bg-primary/90 md:mt-10 md:max-w-104 md:text-[28px]"
        >
          <Link href={CATALOG_HREF}>Volver al catalogo</Link>
        </Button>
      </div>
    </main>
  );
}
