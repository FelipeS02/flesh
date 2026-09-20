import { getImageProps } from 'next/image';
import SheetBackground from './assets/sheet-background.webp';

export { SheetBackground };

/**
 * The one declaration of the plate's slot, read by BOTH the `<Image>` in
 * `sheet.tsx` and the preload below.
 *
 * A preload only warms the cache when it resolves to the same candidate the
 * `<img>` goes on to request, and the candidate is chosen from `sizes`. Two
 * copies of this string would drift the first time someone widened the
 * drawer, and nothing would break loudly: the preload would just quietly go
 * back to being bytes nobody uses.
 */
export const SHEET_BACKGROUND_SIZES = '(max-width: 767px) 100vw, 448px';

/**
 * Warms the drawer's decorative plate from the document head.
 *
 * It cannot be the `<Image>`'s own `preload` prop, which is the ordinary way
 * to do this: `SheetContent` mounts when the drawer opens, so the link would
 * appear at the exact moment it was already too late to help.
 *
 * `getImageProps` is what makes the hand-written link correct. The `<Image>`
 * does NOT request the imported file — it requests `/_next/image`, in AVIF
 * per `next.config.ts`, at one of eight generated widths — so preloading the
 * raw asset fetched a resource the page never asked for again. Running the
 * same loader here yields that exact srcset, and handing it over as
 * `imagesrcset`/`imagesizes` rather than a single `href` leaves the width to
 * the browser, which is the only side that knows the viewport and the DPR.
 */
export function SheetBackgroundPreload() {
  const { props } = getImageProps({
    src: SheetBackground,
    sizes: SHEET_BACKGROUND_SIZES,
    fill: true,
    alt: '',
  });

  return (
    <link
      rel='preload'
      as='image'
      imageSrcSet={props.srcSet}
      imageSizes={props.sizes}
      // Speculative, and explicitly demoted for it. This link exists so the
      // plate is warm WHENEVER the shopper opens it, which is never during
      // the first paint — but a `rel=preload as=image` is HIGH priority by
      // default, so without this it left the head racing the one image the
      // page is actually measured on.
      fetchPriority='low'
    />
  );
}
