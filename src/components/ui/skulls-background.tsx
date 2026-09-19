import Image from 'next/image';
import { getImageProps } from 'next/image';
import SkullsBackground from './assets/cookies-skulls.webp';

export { SkullsBackground };

/**
 * The one declaration of the plate's slot, read by BOTH `SkullsBackdrop` and
 * the preload below — the same discipline `sheet-background.tsx` follows, and
 * for the same reason: a preload that resolves to a different candidate than
 * the `<img>` warms a resource nobody asks for.
 *
 * 350 is the toast's own `w-[min(350px,100vw-40px)]`. The narrower phone case
 * is deliberately not declared: over-asking by 70px on a 320px screen costs
 * nothing here, because the source is only 480 wide and there is no larger
 * candidate for the browser to be talked into.
 */
export const SKULLS_BACKGROUND_SIZES = '350px';

/**
 * The decorative plate behind a toast's content.
 *
 * 12% and not the sheet's 20%: the drawer wears this behind a sparse panel,
 * while a toast puts three lines of dense copy and a thumbnail on top of it.
 * At 20% the skulls read as noise behind the price.
 *
 * The source is 480px wide against a 350px slot — under 2x, and chosen on
 * purpose. At 720 the file is 102 KB against 51, and composited at 12% over
 * the popover ground the two are indistinguishable; what a visitor would be
 * paying the extra 51 KB for is stipple detail that the opacity already
 * erased.
 *
 * CONTRACT: the parent must open a stacking context of its own — `isolate`,
 * or a `z-index` — and clip its overflow. At `-z-1` under a parent that does
 * neither, this paints below that parent's background instead of above it.
 */
export function SkullsBackdrop() {
  return (
    <Image
      src={SkullsBackground}
      alt=""
      aria-hidden
      fill
      sizes={SKULLS_BACKGROUND_SIZES}
      className="-z-1 object-cover opacity-[0.12] scale-105"
    />
  );
}

/**
 * Warms the plate from the document head.
 *
 * Same mechanism as `SheetBackgroundPreload`, and the same reason it cannot
 * be the `<Image>`'s own `preload` prop: the toast mounts when the shopper
 * adds to cart, so a link emitted there would arrive with the toast it was
 * meant to precede.
 */
export function SkullsBackgroundPreload() {
  const { props } = getImageProps({
    src: SkullsBackground,
    sizes: SKULLS_BACKGROUND_SIZES,
    fill: true,
    alt: '',
  });

  return (
    <link
      rel="preload"
      as="image"
      imageSrcSet={props.srcSet}
      imageSizes={props.sizes}
    />
  );
}
