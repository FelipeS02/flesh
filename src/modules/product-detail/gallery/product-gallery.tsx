'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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

/**
 * How many slides ahead of the selected one commit their fetch.
 *
 * Native `lazy` inside a snap container only commits when the slide is nearly
 * on screen, so the photo used to fade in DURING the gesture. Flipping the
 * attribute to `eager` resumes a deferred load, so this window walks with the
 * selection and the next photo has already landed by the time it arrives. One
 * is enough: the gallery advances a slide at a time, and a thumbnail jump
 * moves the selection before its scroll finishes.
 */
const PRELOAD_AHEAD = 1;

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
  // Typed as the primitive's own return, not `HTMLDivElement`: this now
  // comes from Embla's `rootNode()` (see the effect below) rather than a JSX
  // `ref`, and the carousel API declares that accessor as `HTMLElement`.
  const mobileStage = useRef<HTMLElement>(null);
  const pendingDesktopTarget = useRef<number | null>(null);

  // `position` is the wire's ordering field. The incoming array is incidental.
  const ordered = [...images].toSorted((a, b) => a.position - b.position);
  const imageSignature = ordered
    .map((image) => `${image.id}:${image.position}:${image.src}`)
    .join('|');
  const previousImageSignature = useRef(imageSignature);
  const selected = clampIndex(selectedIndex, ordered.length);
  const hasRail = ordered.length > 1;

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

  // An Effect Event, not a `useCallback`: it only ever runs from the scroll
  // listener the effect below attaches, and it must read the CURRENT slide
  // count without that count becoming a reason to resubscribe. As a callback
  // dependency, every change to the gallery tore the listener down and
  // reattached it. `alignMobile` cannot follow: `select` calls it from a click
  // handler, and an Effect Event may only be called from inside an effect.
  const observeMobileScroll = useEffectEvent(() => {
    const node = mobileStage.current;
    if (!node || node.clientWidth <= 0) return;

    // Observation only: correcting a touch gesture fights the browser's
    // momentum and snap physics. Explicit thumbnail navigation is above.
    setSelectedIndex(
      clampIndex(Math.round(node.scrollLeft / node.clientWidth), ordered.length),
    );
  });

  // The single Embla instance's own viewport node is now ALSO the native
  // scroll container mobile swipes against (see `viewportClassName` on
  // `CarouselContent`). Reading it back through `rootNode()` once the engine
  // exists reaches that element without asking the primitive to forward a
  // second ref onto it. The listener only ever attaches below `md`: on
  // desktop the viewport is `overflow-hidden` and Embla repositions it with a
  // transform, so a native `scroll` event there would never correspond to a
  // real selection change.
  useEffect(() => {
    const node = api?.rootNode() ?? null;
    mobileStage.current = node;
    if (!node || isDesktop) return;

    const onScroll = () => observeMobileScroll();
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, [api, isDesktop]);

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

    // A thumbnail can be activated between the gallery mounting and Embla
    // publishing its API. Deliver that command before normal handoff
    // alignment, otherwise the stale confirmed index silently wins.
    if (!flushPendingTarget()) api.scrollTo(selected, true);

    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api, isDesktop, ordered.length]);

  // Leaving desktop invalidates commands queued for the desktop engine while
  // it was active — the engine itself now stays mounted, only inactive.
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
        // Which LANE the hero photo's preload goes in — not whether it gets
        // one. React's server renderer already emits a
        // `<link rel="preload" as="image">` for every non-lazy <img> in the
        // shell, so both this slide and the lookahead below were ALREADY being
        // preloaded, at the same default priority, alongside the drawer and
        // toast plates the layout warms. Four equal preloads is four ways to
        // not be first, and the one the page is measured on was losing.
        //
        // `high` is read twice: React sorts it into `highImagePreloads`, which
        // is flushed earlier in the head, and the browser honours the
        // `fetchpriority` attribute when it schedules the request.
        //
        // Everything else is `low` because it is SPECULATIVE. The lookahead
        // window exists so the next photo has landed before the swipe that
        // needs it — a real win, and never worth a millisecond taken from the
        // photo already on screen.
        fetchPriority={index === 0 ? 'high' : 'low'}
        loading={index <= selected + PRELOAD_AHEAD ? 'eager' : 'lazy'}
      />
    );
  };

  return (
    <div className='flex h-[calc(var(--pdp-viewport-height,100svh)-var(--pdp-band-height,6.5rem)-var(--pdp-widget-height,9.5rem))] w-full flex-col max-md:pb-2 gap-4 md:h-auto md:flex-row md:items-start'>
      <div
        ref={stage}
        data-gallery-stage
        data-orientation={isDesktop ? 'vertical' : 'horizontal'}
        className='relative -mx-4 min-h-0 w-[calc(100%+2rem)] flex-1 md:mx-0 md:w-full md:min-w-0'
      >
        {/*
          One tree for both layouts: CSS (`md:`) owns the layout switch, not
          React. `active: false` below `md` still builds Embla's engine (so
          `selectedScrollSnap`/`slideNodes`/`scrollProgress` all work) but
          skips translate/drag/resize init — real native scroll-snap owns the
          gesture there instead, on the viewport `CarouselContent` exposes via
          `viewportClassName`. Crossing the breakpoint runs Embla's own
          `reActivate`, and the server-painted hero `<img>` never unmounts.
        */}
        <Carousel
          orientation='vertical'
          opts={{
            duration: 20,
            active: false,
            breakpoints: { [DESKTOP_QUERY]: { active: true } },
          }}
          setApi={setApi}
          aria-label={`Galería de imágenes de ${title}`}
          className={cn(
            'h-full w-full mx-auto *:data-[slot=carousel-content]:h-full',
            'mask-b-from-98% md:mask-y-from-(--gallery-mask-stop,100%) md:max-w-220',
            dimmed && 'opacity-40',
          )}
        >
          <CarouselContent
            // Below `md` this IS the mobile stage: Embla stays inactive, so
            // nothing fights the browser's own scroll-snap physics.
            viewportClassName={cn(
              'overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden',
              'md:overflow-hidden md:snap-none',
            )}
            className='mt-0 ml-0 h-full flex-row md:h-180.5 md:flex-col'
          >
            {ordered.map((image, index) => (
              <CarouselItem
                key={image.id}
                aria-label={`Imagen ${index + 1} de ${ordered.length}`}
                className='min-w-full shrink-0 snap-center pt-0 pl-0 md:min-w-0'
              >
                <div className='relative size-full'>{renderImage(image, index)}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

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
        <ul className='flex shrink-0 gap-1.5 max-md:justify-center md:order-first md:flex-col md:gap-2'>
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
