'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { type ImageView, mediaSource } from '@/modules/catalog/client';
import {
  MASK_STOP_AT_REST,
  maskStop,
  restingSlideVisualStates,
  slideVisualStates,
  type SlideVisualState,
} from './slide-blur';
import { useWheelNavigation } from './use-wheel-navigation';

const DESKTOP_QUERY = '(min-width: 768px)';

/** Matches `md:max-w-140` on the stage below; both must move together. */
const STAGE_WIDTH = 560;

/**
 * What the stage DECLARES to the browser, deliberately double the CSS width
 * it actually occupies.
 *
 * `sizes` is a CSS-pixel promise, and the browser multiplies it by the
 * device's pixel ratio to choose a candidate. Declaring the honest 560 means
 * a 1x display asks for 560 real pixels and gets handed the 640 candidate —
 * 1.14 device pixels per CSS pixel, the bare minimum the spec allows, and
 * soft the moment the browser resamples it. That is correct behaviour and it
 * still looks wrong on the one photo this page exists to sell.
 *
 * So the slot asks for a 2x-grade image on every display, not just retina
 * ones. It is a real trade — a 1x visitor downloads ~25 KB instead of ~10 KB
 * — and it is bought knowingly HERE and nowhere else: this is the hero of the
 * product page. The card grid, which renders dozens of photos, keeps its
 * honest declaration.
 */
const STAGE_DECLARED_WIDTH = STAGE_WIDTH * 2;

/**
 * Above the 75 default, and deliberately. The garment photos arrive as PNG —
 * lossless compression applied to photography — and re-encoding one at 75
 * is where fabric texture turns to mush. This is the hero image of the page
 * that sells the garment; the extra bytes are the cheapest thing here.
 */
const GALLERY_QUALITY = 90;

/** The rail renders at 64 CSS px, so the CDN's 240 derivative covers it at 2x. */
const THUMBNAIL_WIDTH = 64;

type ProductGalleryProps = {
  images: ImageView[];
  title: string;
  badge?: ReactNode;
  dimmed?: boolean;
};

type DesktopApi = NonNullable<CarouselApi>;

function clampIndex(index: number, imageCount: number): number {
  if (imageCount < 1) return 0;

  return Math.min(Math.max(index, 0), imageCount - 1);
}

/**
 * The custom property the desktop carousel's `mask-y-from-*` reads. It is
 * set on the stage rather than on the carousel because custom properties
 * inherit, and the stage is the node this component already holds a ref to.
 */
const MASK_STOP_PROPERTY = '--gallery-mask-stop';

function paintMaskStop(node: HTMLElement | null, stop: number): void {
  node?.style.setProperty(MASK_STOP_PROPERTY, `${stop}%`);
}

function clearDesktopStyles(api: DesktopApi | undefined): void {
  api?.slideNodes().forEach((slide) => {
    slide.style.transform = '';
    slide.style.opacity = '';
    slide.style.filter = '';
    slide.style.pointerEvents = '';
  });
}

function paintDesktopStyles(api: DesktopApi, values: SlideVisualState[]): void {
  api.slideNodes().forEach((slide, index) => {
    const value = values[index];
    if (!value) return;

    slide.style.transform = `scale(${value.scale})`;
    slide.style.opacity = String(value.opacity);
    slide.style.filter = value.filter;
    slide.style.pointerEvents = value.pointerEvents;
  });
}

/** A single state boundary for the native mobile and controlled desktop engines. */
export function ProductGallery({ images, title, badge, dimmed }: ProductGalleryProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [api, setApi] = useState<DesktopApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const mobileStage = useRef<HTMLDivElement>(null);
  const pendingDesktopTarget = useRef<number | null>(null);

  // `position` is the wire's ordering field. The incoming array is incidental.
  const ordered = [...images].toSorted((a, b) => a.position - b.position);
  const imageSignature = ordered
    .map((image) => `${image.id}:${image.position}:${image.src}`)
    .join('|');
  const previousImageSignature = useRef(imageSignature);
  const selected = clampIndex(selectedIndex, ordered.length);
  const hasRail = ordered.length > 1;

  // Carousel does not publish `undefined` when it unmounts, so the dead Embla
  // identity outlives the desktop branch and every effect below would go on
  // commanding it. Dropping it while rendering the switch — React's "adjusting
  // state when a prop changes" — is what keeps a committed render from ever
  // pairing the current `isDesktop` with the other branch's engine. An effect
  // cleared it a render too late, and only on the way out to mobile: coming
  // back to desktop still handed the stale api to the effects below until
  // Embla republished.
  const [renderedDesktop, setRenderedDesktop] = useState(isDesktop);
  if (renderedDesktop !== isDesktop) {
    setRenderedDesktop(isDesktop);
    setApi(undefined);
  }

  // Kept manual, unlike the plain values above: this identity gates the mobile
  // handoff effect, and Vitest runs without `babel-plugin-react-compiler`, so
  // there the compiler's automatic memoization does not exist. Recreated every
  // render, the effect re-runs every render and re-aligns the stage mid-gesture
  // — the exact correction `observeMobileScroll` refuses to make.
  const alignMobile = useCallback((index: number, behavior: ScrollBehavior) => {
    const node = mobileStage.current;
    if (!node) return;

    const left = index * node.clientWidth;
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ left, behavior });
    } else {
      node.scrollLeft = left;
    }
  }, []);

  // A changed identity/order can make the same index refer to another image.
  // Reset both engines together rather than carrying a stale visual selection.
  useEffect(() => {
    if (previousImageSignature.current === imageSignature) return;

    previousImageSignature.current = imageSignature;
    setSelectedIndex(0);
    api?.scrollTo(0, true);
    alignMobile(0, 'auto');
  }, [alignMobile, api, imageSignature]);

  useEffect(() => {
    if (!api || !isDesktop) return;

    const flushPendingTarget = () => {
      const target = pendingDesktopTarget.current;
      if (target === null) return false;

      pendingDesktopTarget.current = null;
      api.scrollTo(clampIndex(target, ordered.length));
      return true;
    };
    const sync = () => {
      if (flushPendingTarget()) return;

      setSelectedIndex(clampIndex(api.selectedScrollSnap(), ordered.length));
    };
    api.on('select', sync);
    api.on('reInit', sync);

    // A thumbnail can be activated between the desktop branch mounting and
    // Embla publishing its API. Deliver that command before normal handoff
    // alignment, otherwise the stale confirmed index silently wins.
    if (!flushPendingTarget()) api.scrollTo(selected, true);

    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api, isDesktop, ordered.length]);

  // Leaving desktop invalidates commands queued for its unmounted engine.
  // Mobile handoff aligns only the last position an engine actually confirmed.
  useEffect(() => {
    if (isDesktop) return;

    pendingDesktopTarget.current = null;
    alignMobile(selected, 'auto');
  }, [alignMobile, isDesktop]);

  // Per-frame style work stays outside React: scroll events only paint the
  // controlled desktop slide nodes and never re-render the gallery.
  useEffect(() => {
    if (!api || !isDesktop) {
      clearDesktopStyles(api);
      paintMaskStop(stage.current, MASK_STOP_AT_REST);
      return;
    }

    const paintMoving = () => {
      const progress = api.scrollProgress();
      const count = api.slideNodes().length;

      paintDesktopStyles(api, slideVisualStates(progress, count));
      paintMaskStop(stage.current, maskStop(progress, count));
    };
    const paintResting = () => {
      paintDesktopStyles(
        api,
        restingSlideVisualStates(
          api.selectedScrollSnap(),
          api.slideNodes().length,
        ),
      );
      // Written as the constant rather than through `maskStop`, for the same
      // reason the blur has a resting path: a float round-trip can leave a
      // sliver of fade on the photo the page is parked on.
      paintMaskStop(stage.current, MASK_STOP_AT_REST);
    };

    paintResting();
    api.on('scroll', paintMoving);
    api.on('settle', paintResting);
    api.on('reInit', paintResting);

    return () => {
      api.off('scroll', paintMoving);
      api.off('settle', paintResting);
      api.off('reInit', paintResting);
      clearDesktopStyles(api);
      paintMaskStop(stage.current, MASK_STOP_AT_REST);
    };
  }, [api, isDesktop]);

  useWheelNavigation({ api, target: stage, enabled: isDesktop });

  function select(index: number) {
    const nextIndex = clampIndex(index, ordered.length);

    if (isDesktop) {
      if (api) api.scrollTo(nextIndex);
      else pendingDesktopTarget.current = nextIndex;
      return;
    }

    alignMobile(nextIndex, 'smooth');
  }

  function observeMobileScroll() {
    const node = mobileStage.current;
    if (!node || node.clientWidth <= 0) return;

    // Observation only: correcting a touch gesture fights the browser's
    // momentum and snap physics. Explicit thumbnail navigation is above.
    setSelectedIndex(
      clampIndex(Math.round(node.scrollLeft / node.clientWidth), ordered.length),
    );
  }

  const renderImage = (image: ImageView, index: number) => {
    // The stage is 560 CSS px, so at 2x it needs ~1120 — past every
    // derivative the CDN has generated (the widest is 640). `mediaSource`
    // therefore resolves this to the untouched original and lets Next
    // downscale it: that original is a 2395px PNG, so this is the one slot
    // in the app where our own optimizer is genuinely earning its cost.
    //
    // It is also what lifts the ceiling. The API's `src` is a 1024x788
    // derivative, and pointing Next at THAT capped the whole gallery at
    // 1024 source pixels no matter what `sizes` asked for.
    const source = mediaSource(image.src, { width: STAGE_WIDTH });

    return (
      <Image
        src={source.src}
        unoptimized={source.unoptimized}
        alt={`${title} — imagen ${index + 1} de ${ordered.length}`}
        fill
        // Only the desktop clause is inflated (see STAGE_DECLARED_WIDTH).
        // Mobile keeps the honest `100vw`: phones are 2x or 3x almost without
        // exception, so the multiplication already lands on a large candidate
        // there, and doubling it again would spend a visitor's data to fix a
        // problem they do not have.
        sizes={`(min-width: 768px) ${STAGE_DECLARED_WIDTH}px, 100vw`}
        quality={GALLERY_QUALITY}
        className='object-contain'
        loading={index === 0 ? 'eager' : 'lazy'}
      />
    );
  };

  return (
    <div className='flex h-[calc(100svh-var(--pdp-band-height,6.5rem)-var(--pdp-widget-height,9.5rem))] w-full flex-col gap-4 md:h-auto md:flex-row md:items-start'>
      <div
        ref={stage}
        data-gallery-stage
        data-orientation={isDesktop ? 'vertical' : 'horizontal'}
        className='relative -mx-4 min-h-0 w-[calc(100%+2rem)] flex-1 md:mx-0 md:w-full md:min-w-0'
      >
        {isDesktop ? (
          <Carousel
            opts={{ duration: 20 }}
            orientation='vertical'
            setApi={setApi}
            className={cn(
              'h-full w-full mask-y-from-(--gallery-mask-stop,100%) *:data-[slot=carousel-content]:h-full mx-auto md:max-w-220',
              dimmed && 'opacity-40',
            )}
          >
            <CarouselContent className='mt-0 ml-0 h-full  md:h-180.5'>
              {ordered.map((image, index) => (
                <CarouselItem key={image.id} className='pt-0 pl-0'>
                  <div className='relative size-full'>{renderImage(image, index)}</div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <div
            ref={mobileStage}
            data-gallery-mobile-stage
            role='region'
            aria-label={`Galería de imágenes de ${title}`}
            aria-roledescription='carousel'
            onScroll={observeMobileScroll}
            className={cn(
              'flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden',
              dimmed && 'opacity-40',
            )}
          >
            {ordered.map((image, index) => (
              <div
                key={image.id}
                role='group'
                aria-label={`Imagen ${index + 1} de ${ordered.length}`}
                aria-roledescription='slide'
                data-slot='carousel-item'
                className='relative min-w-full shrink-0 snap-center'
              >
                {renderImage(image, index)}
              </div>
            ))}
          </div>
        )}

        {badge && (
          <div data-gallery-badge className='absolute top-3 left-7 md:top-4 md:left-4'>
            {badge}
          </div>
        )}

        {hasRail && (
          <p
            aria-hidden='true'
            className='absolute top-2 right-6 pt-1 pb-0.5 font-display text-[11px] text-secondary md:hidden'
          >
            {selected + 1} / {ordered.length}
          </p>
        )}
      </div>

      {hasRail && (
        <ul className='flex shrink-0 gap-1.5 md:order-first md:flex-col md:gap-2'>
          {ordered.map((image, index) => {
            const active = index === selected;

            return (
              <li key={image.id}>
                <Button
                  type='button'
                  variant='ghost'
                  aria-current={active ? 'true' : undefined}
                  aria-pressed={active}
                  aria-label={`Ver imagen ${index + 1} de ${ordered.length}`}
                  onClick={() => select(index)}
                  className={cn(
                    'relative block h-15.5 w-14 overflow-hidden rounded-none border border-transparent p-0 transition-[border-color,opacity] md:h-18 md:w-16',
                    active ? 'border-foreground' : 'opacity-50',
                  )}
                >
                  {/* The opposite call to the stage above: at 64 CSS px the
                      CDN's 240 derivative already covers 2x, arrives as ~3 KB
                      of WebP, and costs us nothing to serve. Routing it
                      through our optimizer would re-encode an image that is
                      already right. */}
                  <Image
                    {...mediaSource(image.src, { width: THUMBNAIL_WIDTH })}
                    alt=''
                    fill
                    sizes='64px'
                    className='object-contain'
                  />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
