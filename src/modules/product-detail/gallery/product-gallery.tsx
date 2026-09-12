'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { ImageView } from '@/modules/catalog/client';
import { restingBlurValues, slideBlurValues } from './slide-blur';
import { useWheelNavigation } from './use-wheel-navigation';

/** The `md` breakpoint, spelled the way Tailwind spells it. */
const DESKTOP_QUERY = '(min-width: 768px)';

type ProductGalleryProps = {
  images: ImageView[];
  /** Names the garment in each slide's `alt`; the gallery renders no text. */
  title: string;
  /**
   * Rendered over the top-left of the stage. Taken as a NODE rather than as a
   * state the gallery would have to interpret: the badge is static server
   * content, and passing it in keeps it on the server instead of dragging the
   * tag rules and their copy across this client boundary.
   */
  badge?: ReactNode;
  /** Fades the stage, for a garment that is not for sale. */
  dimmed?: boolean;
};

/**
 * The PDP's image viewer.
 *
 * Two things the artboards settled and the code should not re-litigate:
 * there are NO chevrons — the rail is the only control — and the carousel
 * runs VERTICALLY on desktop, horizontally on mobile.
 *
 * That axis is the one reason this is a client component. Everything else
 * the two layouts disagree about (which side the rail sits on, whether the
 * counter shows) is plain CSS below.
 */
export function ProductGallery({
  images,
  title,
  badge,
  dimmed,
}: ProductGalleryProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  // `position` is the wire's ordering field. The array order it arrives in
  // is incidental and has already been wrong once, so sort rather than trust.
  const ordered = useMemo(
    () => [...images].toSorted((a, b) => a.position - b.position),
    [images],
  );

  useEffect(() => {
    if (!api) return;

    // Subscribe only — no eager read. Embla starts on the first snap, which
    // is the state's own initial value, and the axis swap between breakpoints
    // arrives as `reInit`. Calling it here would just be a render that
    // computes the value it already had.
    const sync = () => setSelectedIndex(api.selectedScrollSnap());
    api.on('select', sync);
    api.on('reInit', sync);

    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api]);

  // The blur is written straight to the slide nodes rather than rendered
  // from state: `scroll` fires every animation frame, and a `setState` per
  // frame would re-render the whole gallery to change one filter string.
  //
  // This effect is the ONLY writer of `style.filter` on a slide. Nothing
  // renders one, which does mean the server's markup is unblurred — but the
  // only slide the server's markup can show is the first one, and that one
  // is sharp at rest anyway.
  useEffect(() => {
    if (!api) return;

    const write = (blurs: number[]) => {
      api.slideNodes().forEach((slide, index) => {
        const blur = blurs[index] ?? 0;

        // A sharp slide gets NO `filter` at all, not `blur(0px)`. Any
        // filter value promotes the slide to its own composited layer and
        // makes the browser rasterise the photo through the filter pipeline
        // — on a phone that layer is rasterised at a lower resolution than
        // the photo, so a slide sitting still at `blur(0px)` still reads
        // soft. Removing the property drops the layer and hands the image
        // back to the ordinary paint path.
        slide.style.filter = blur === 0 ? '' : `blur(${blur}px)`;
      });
    };

    // Mid-motion: continuous, so the incoming slide sharpens as it arrives.
    const paintMoving = () =>
      write(slideBlurValues(api.scrollProgress(), api.slideNodes().length));

    // At rest: addressed by SNAP, never by progress. `scroll` stops a frame
    // or two short of the resting position, and the progress it last
    // reported is a float that rarely lands exactly on the snap — which is
    // what left a slide you were parked on very slightly blurred.
    const paintResting = () =>
      write(
        restingBlurValues(api.selectedScrollSnap(), api.slideNodes().length),
      );

    paintResting();
    api.on('scroll', paintMoving);
    // `settle`, and NOT `select`: `select` fires the moment the
    // destination is decided, while the slides are still travelling, so
    // painting the resting state there would flash the photo sharp
    // mid-drag. `settle` is the one event that means "stopped".
    api.on('settle', paintResting);
    // The axis swap at `md` re-measures every snap, so yesterday's progress
    // describes nothing.
    api.on('reInit', paintResting);

    return () => {
      api.off('scroll', paintMoving);
      api.off('settle', paintResting);
      api.off('reInit', paintResting);
    };
  }, [api]);

  // Desktop only: the wheel is a mouse, and the vertical axis is the one it
  // reads as "next photo". A phone scrolls the page with the same gesture.
  useWheelNavigation({ api, target: stage, enabled: isDesktop });

  const orientation = isDesktop ? 'vertical' : 'horizontal';

  // One image is not a carousel. Without this the rail would render a single
  // thumbnail that selects the slide already on screen, and the counter would
  // read a permanent "1 / 1".
  const hasRail = ordered.length > 1;

  function select(index: number) {
    // Set optimistically so the rail responds on the click rather than on
    // embla's scroll settling. The `select` listener above reconciles, so if
    // embla lands somewhere else it — not this line — has the last word.
    setSelectedIndex(index);
    api?.scrollTo(index);
  }

  return (
    <div className='flex w-full flex-col gap-4 md:flex-row md:items-start'>
      {/* 560px is the artboard's stage width at a 1440 viewport, so it is a
          CEILING, not a fixed size: on any narrower desktop the two-column PDP
          has less than 1296px to divide between gallery and panel, and a rigid
          stage would push the purchase panel off the right edge.

          On mobile the stage BREAKS OUT of the PDP's 16px page padding
          (`px-4` on the route's wrapper) and runs edge to edge. The photos
          are full-bleed studio shots, so leaving them inset let the page
          background show as two strips down the sides and read as a crop.
          The negative margin alone would only shift the box, so the width is
          grown by the same 32px it is pulled out by; `overflow-x-hidden` on
          `body` is what keeps that from ever becoming a scrollbar.

          The thumbnail rail is a SIBLING and deliberately stays inside the
          padding — it is a control, and a control flush against the screen
          edge is one you press by accident while scrolling. */}
      <div
        ref={stage}
        data-gallery-stage
        data-orientation={orientation}
        className='relative -mx-4 w-[calc(100%+2rem)] md:mx-0 md:w-full md:max-w-140 md:min-w-0 md:flex-1'
      >
        {/* `duration` is embla's own transition, in its internal units, not
            milliseconds — 25 is the default. Trimmed because the wheel can
            now queue a step every 90ms, and a transition slower than the
            gesture driving it reads as lag. */}
        <Carousel
          opts={{ duration: 20 }}
          orientation={orientation}
          setApi={setApi}
          // The photo fades, the badge over it does not — the badge is the
          // thing explaining WHY the photo is faded.
          className={cn('w-full', dimmed && 'opacity-40')}
        >
          {/* The height lives on the TRACK, not on a wrapper: embla measures
              the overflow container, and that container takes its height from
              this element. A vertical carousel with an auto-height viewport
              has nothing to scroll within. */}
          {/* One screenful, minus the chrome that frames it: the sticky
              header band above and the fixed purchase widget below. Both
              heights are measured and published by `StageMetrics` — the
              fallbacks are what the first paint and any non-PDP use get, and
              they are deliberately close to the real thing rather than to
              zero, so a missing measurement reads as slightly off rather than
              as a full-bleed photograph.

              `dvh` and not `vh`: on a phone the browser chrome retracts as
              you scroll, and `vh` is the LARGE viewport — sized against it,
              the stage would hide its own bottom edge behind the URL bar on
              the one screen this layout exists to fit exactly.

              Desktop is unchanged: the two-column PDP has the panel beside
              the gallery, so the stage is a fixed 722px there and owes the
              viewport nothing. */}
          <CarouselContent className='mt-0 ml-0 h-[calc(100dvh-var(--pdp-band-height,6.5rem)-var(--pdp-widget-height,9.5rem))] md:h-180.5'>
            {ordered.map((image, index) => (
              <CarouselItem key={image.id} className='pt-0 pl-0'>
                <div className='relative size-full'>
                  {/* `object-contain`: the artboard fits the garment inside
                      the stage rather than cropping it. */}
                  <Image
                    src={image.src}
                    alt={`${title} — imagen ${index + 1} de ${ordered.length}`}
                    fill
                    sizes='(min-width: 768px) 560px, 100vw'
                    className='object-contain'
                    // `priority` is deprecated as of Next 16 (see
                    // `docs/.../image.md#priority`). The first slide is the
                    // PDP's LCP element, and the docs prefer `loading="eager"`
                    // over `preload` for an element the markup already
                    // discovers this early.
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* The overlays keep the PDP's page gutter even though the stage
            below them no longer has one: on mobile their offsets carry the
            16px the stage gave back, so the badge and the counter sit where
            they always did relative to the SCREEN rather than sliding into
            its corners. */}
        {badge && (
          <div
            data-gallery-badge
            className='absolute top-3 left-7 md:top-4 md:left-4'
          >
            {badge}
          </div>
        )}

        {/* Mobile only, by CSS. Desktop needs no counter because the rail
            beside the photo already shows which image is on screen — on a
            phone the rail is below the fold of the stage. */}
        {hasRail && (
          <p
            aria-hidden='true'
            className='absolute top-2 right-6 pt-1 pb-0.5 font-display text-[11px] text-secondary md:hidden'
          >
            {selectedIndex + 1} / {ordered.length}
          </p>
        )}
      </div>

      {/* Last in the DOM so the photo is what a screen reader reaches first;
          `md:order-first` is what moves the rail to the left on desktop. */}
      {hasRail && (
        <ul className='flex shrink-0 gap-1.5 md:order-first md:flex-col md:gap-2'>
          {ordered.map((image, index) => {
            const active = index === selectedIndex;

            return (
              <li key={image.id}>
                <button
                  type='button'
                  aria-pressed={active}
                  aria-label={`Ver imagen ${index + 1} de ${ordered.length}`}
                  onClick={() => select(index)}
                  className={cn(
                    'relative block h-15.5 w-14 overflow-hidden border border-transparent transition-[border-color,opacity] md:h-18 md:w-16',
                    active ? 'border-foreground' : 'opacity-50',
                  )}
                >
                  {/* Decorative: the button's label already says which image
                      this is, so announcing the garment again would read the
                      same product five times over. */}
                  <Image
                    src={image.src}
                    alt=''
                    fill
                    sizes='64px'
                    className='object-cover'
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
