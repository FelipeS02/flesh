'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
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
  DESKTOP_GALLERY_ENGINE,
  DESKTOP_GALLERY_UNDER_HEADER,
  DESKTOP_NEXT_SLIDE_PEEK,
  DESKTOP_SCROLL_SNAP,
} from './gallery-config';
import { useEmblaDesktop } from './use-embla-desktop';
import {
  scrollToSlide,
  scrollUnit,
  useNativeDesktopScroll,
} from './use-native-desktop-scroll';

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

const NATIVE_ENGINE = DESKTOP_GALLERY_ENGINE === 'native-scroll';

/**
 * The most of the stage the next slide may take. A peek of 1 or more would
 * leave the parked slide no height at all, so a typo in the knob is clamped
 * rather than collapsing the gallery.
 */
const MAX_NEXT_SLIDE_PEEK = 0.9;

function clampIndex(index: number, imageCount: number): number {
  if (imageCount < 1) return 0;

  return Math.min(Math.max(index, 0), imageCount - 1);
}

/**
 * A single state boundary for the native mobile scroller and whichever desktop
 * engine `gallery-config` selects (a native vertical scroller, or the
 * controlled Embla carousel).
 */
export function ProductGallery({ images, title, badge, dimmed }: ProductGalleryProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [api, setApi] = useState<DesktopApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  // The native scroll container: mobile's horizontal scroller and, with the
  // native engine, desktop's vertical one. Typed as the primitive's own
  // return, not `HTMLDivElement`: it comes from Embla's `rootNode()` (see the
  // effect below) rather than a JSX `ref`, and the carousel API declares that
  // accessor as `HTMLElement`.
  const scroller = useRef<HTMLElement>(null);
  // Whether a native scroll, rather than Embla, is what moves the gallery at
  // this width. Mobile is always native; desktop only with the native engine.
  const nativeDesktop = isDesktop && NATIVE_ENGINE;
  // Whether the native desktop scroller runs up behind the sticky header. Only
  // meaningful with the native engine; the Embla one moves by transform inside
  // a clipped viewport and has nothing to scroll under anything.
  const underHeader = NATIVE_ENGINE && DESKTOP_GALLERY_UNDER_HEADER;
  const peek = Math.min(Math.max(DESKTOP_NEXT_SLIDE_PEEK, 0), MAX_NEXT_SLIDE_PEEK);

  // `position` is the wire's ordering field. The incoming array is incidental.
  const ordered = [...images].toSorted((a, b) => a.position - b.position);
  const imageSignature = ordered
    .map((image) => `${image.id}:${image.position}:${image.src}`)
    .join('|');
  const previousImageSignature = useRef(imageSignature);
  const selected = clampIndex(selectedIndex, ordered.length);
  const hasRail = ordered.length > 1;

  // Kept manual, unlike the plain values above: this identity gates the
  // handoff effect, and Vitest runs without `babel-plugin-react-compiler`, so
  // there the compiler's automatic memoization does not exist. Recreated every
  // render, the effect re-runs every render and re-aligns the stage mid-gesture
  // — the exact correction `observeScroll` refuses to make.
  const alignScroller = useCallback(
    (index: number, behavior: ScrollBehavior, vertical: boolean) =>
      scrollToSlide(scroller.current, index, vertical, behavior),
    [],
  );

  // An Effect Event, not a `useCallback`: it only ever runs from the scroll
  // listener the effect below attaches, and it must read the CURRENT slide
  // count without that count becoming a reason to resubscribe. As a callback
  // dependency, every change to the gallery tore the listener down and
  // reattached it. `alignScroller` cannot follow: `select` calls it from a
  // click handler, and an Effect Event may only be called from inside an
  // effect.
  //
  // One observation for both layouts, generalised by axis: a native scroller
  // is one slide per viewport, so the selection is the nearest multiple of
  // its client size whichever way it scrolls.
  const observeScroll = useEffectEvent(() => {
    const node = scroller.current;
    if (!node) return;

    const size = scrollUnit(node, nativeDesktop);
    if (size <= 0) return;

    // Observation only: correcting a touch gesture fights the browser's
    // momentum and snap physics. Explicit thumbnail navigation is above.
    const offset = nativeDesktop ? node.scrollTop : node.scrollLeft;
    setSelectedIndex(clampIndex(Math.round(offset / size), ordered.length));
  });

  // The single Embla instance's own viewport node is ALSO the native scroll
  // container: mobile swipes against it horizontally and, with the native
  // engine, desktop scrolls it vertically (see `viewportClassName` on
  // `CarouselContent`). Reading it back through `rootNode()` once the engine
  // exists reaches that element without asking the primitive to forward a
  // second ref onto it. The listener attaches wherever a native scroll is what
  // moves the gallery. With the Embla desktop engine the viewport is
  // `overflow-hidden` and Embla repositions it with a transform, so a native
  // `scroll` event there would never correspond to a real selection change.
  useEffect(() => {
    const node = api?.rootNode() ?? null;
    scroller.current = node;
    if (!node || (isDesktop && !nativeDesktop)) return;

    const onScroll = () => observeScroll();
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, [api, isDesktop, nativeDesktop]);

  // A changed identity/order can make the same index refer to another image.
  // Reset both engines together rather than carrying a stale visual selection.
  useEffect(() => {
    if (previousImageSignature.current === imageSignature) return;

    previousImageSignature.current = imageSignature;
    setSelectedIndex(0);
    api?.scrollTo(0, true);
    alignScroller(0, 'auto', nativeDesktop);
  }, [alignScroller, api, imageSignature, nativeDesktop]);

  // Crossing the breakpoint hands the last position an engine actually
  // confirmed to whichever scroller takes over: leaving desktop re-aligns the
  // horizontal mobile scroller, entering desktop with the native engine aligns
  // the vertical one. The Embla desktop engine aligns itself (see its sync
  // effect), so it is skipped here. `auto`, so it lands instantly instead of
  // animating a scroller that just became visible.
  useEffect(() => {
    if (isDesktop && !nativeDesktop) return;

    alignScroller(selected, 'auto', nativeDesktop);
  }, [alignScroller, isDesktop, nativeDesktop]);

  const embla = useEmblaDesktop({
    api,
    enabled: isDesktop && !NATIVE_ENGINE,
    count: ordered.length,
    selected,
    stage,
    onSelect: setSelectedIndex,
  });

  // Declared after the Embla engine on purpose: on the render where `api`
  // arrives both effects run, and the Embla engine's disabled path clears
  // slide styles. The native paint has to be the later write.
  useNativeDesktopScroll({
    api,
    viewport: scroller,
    stage,
    enabled: nativeDesktop,
    count: ordered.length,
  });

  function select(index: number) {
    const nextIndex = clampIndex(index, ordered.length);

    if (isDesktop && !nativeDesktop) {
      embla.select(nextIndex);
      return;
    }

    alignScroller(nextIndex, 'smooth', nativeDesktop);
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
        className={cn(
          'relative -mx-4 min-h-0 w-[calc(100%+2rem)] flex-1 md:mx-0 md:w-full md:min-w-0',
          NATIVE_ENGINE && [
            // How far the sticky column sits below the top of the page: the
            // header band plus the 40px `md:mt-10` above the gallery (the same
            // sum `page.tsx` uses for its `top`). Defined once, as a property,
            // so every consumer below reads one number instead of its own
            // copy of the calc. Named for what it is used for under the
            // header; with that off it still sizes the stage.
            'md:[--gallery-under-header-offset:calc(var(--pdp-band-height,11.25rem)+(--spacing(10)))]',
            // The part of the stage below the header, running to the BOTTOM of
            // the window so no page shows under it. Never under 722px (the
            // old fixed stage), so a short window cannot squash the photo.
            'md:[--gallery-visible:max(--spacing(180.5),calc(100svh-var(--gallery-under-header-offset)))]',
            // One slide is the visible stage minus the strip the NEXT slide
            // peeks into (`--gallery-peek`, set below from the config knob).
            'md:[--gallery-slide:calc(var(--gallery-visible)*(1-var(--gallery-peek,0)))]',
            'md:[--gallery-peek-strip:calc(var(--gallery-visible)-var(--gallery-slide))]',
          ],
          // Raises ONLY the stage — the rail beside it stays put — by that
          // offset, so the scroller can run up behind the header.
          underHeader && 'md:-mt-(--gallery-under-header-offset)',
        )}
        style={NATIVE_ENGINE ? ({ '--gallery-peek': peek } as CSSProperties) : undefined}
      >
        {/*
          One tree for both layouts: CSS (`md:`) owns the layout switch, not
          React. Embla is built once and never unmounted, and the server-painted
          hero `<img>` never unmounts with it. What changes across the
          breakpoint is only who moves the slides.

          Below `md`, and on desktop with the native engine, `active: false`
          still builds Embla's engine but skips translate/drag/resize init —
          real native scroll-snap owns the gesture instead, on the viewport
          `CarouselContent` exposes via `viewportClassName` (horizontal on
          mobile, vertical on desktop). The native engine never reactivates
          Embla, so there is no breakpoint override. With the Embla desktop
          engine, crossing the breakpoint runs Embla's own `reActivate` and it
          takes over the same viewport as a transform.
        */}
        <Carousel
          orientation='vertical'
          opts={
            NATIVE_ENGINE
              ? { duration: 20, active: false }
              : {
                  duration: 20,
                  active: false,
                  breakpoints: { [DESKTOP_QUERY]: { active: true } },
                }
          }
          setApi={setApi}
          aria-label={`Galería de imágenes de ${title}`}
          className={cn(
            'h-full w-full mx-auto *:data-[slot=carousel-content]:h-full',
            'mask-b-from-98% md:max-w-220',
            NATIVE_ENGINE
              ? [
                  // The viewport's `h-full` (above) follows this box. With the
                  // header offset the box grows by exactly that much, so the
                  // first photo still lands where it always did.
                  underHeader
                    ? 'md:h-[calc(var(--gallery-under-header-offset)+var(--gallery-visible))]'
                    : 'md:h-(--gallery-visible)',
                  // Top and bottom are separate properties because the fades
                  // are independent here: each is on only while there is
                  // content beyond that edge.
                  'md:mask-t-from-(--gallery-mask-top,100%) md:mask-b-from-(--gallery-mask-bottom,100%)',
                ]
              : 'md:mask-y-from-(--gallery-mask-stop,100%)',
            dimmed && 'opacity-40',
          )}
        >
          <CarouselContent
            // Below `md` this IS the mobile stage: Embla stays inactive, so
            // nothing fights the browser's own scroll-snap physics.
            viewportClassName={cn(
              'overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden',
              NATIVE_ENGINE
                ? [
                    // The viewport is the desktop scroller too. No
                    // `overscroll-contain`, deliberately: default scroll
                    // chaining hands the wheel to the page once the gallery
                    // hits either end, so a reader heading for the size
                    // selector is never trapped on the last photo.
                    // `scroll-auto` turns off the mobile `scroll-smooth`
                    // here, so an explicit `auto` alignment is instant and
                    // only thumbnail jumps animate.
                    'md:overflow-x-hidden md:overflow-y-auto md:scroll-auto',
                    DESKTOP_SCROLL_SNAP
                      ? 'md:snap-y md:snap-mandatory'
                      : 'md:snap-none',
                    // Room below the last slide equal to the strip the next
                    // one peeks into. Without it the last slide could never
                    // reach the top (max scrollTop would be n*S - visible, not
                    // (n-1)*S), so its bottom fade would never clear and the
                    // last thumbnail would never be selected.
                    'md:pb-(--gallery-peek-strip)',
                    // Padding lets the first photo start below the header
                    // while scrolled content still runs up behind it.
                    // `scroll-pt` is the snap half: without it a snapped
                    // photo would park flush with the viewport top, under the
                    // header, instead of in the stage.
                    underHeader &&
                      'md:pt-(--gallery-under-header-offset) md:scroll-pt-(--gallery-under-header-offset)',
                  ]
                : 'md:overflow-hidden md:snap-none',
            )}
            className={
              NATIVE_ENGINE
                ? 'mt-0 ml-0 h-full flex-row md:h-auto md:flex-col'
                : 'mt-0 ml-0 h-full flex-row md:h-180.5 md:flex-col'
            }
          >
            {ordered.map((image, index) => (
              <CarouselItem
                key={image.id}
                aria-label={`Imagen ${index + 1} de ${ordered.length}`}
                className={cn(
                  'min-w-full shrink-0 snap-center pt-0 pl-0 md:min-w-0',
                  // Native slides size themselves: the track is `h-auto`, so
                  // the default `basis-full` would resolve against nothing.
                  // Each is `--gallery-slide` tall, which is what makes
                  // `scrollTop / slideHeight` the fractional slide index.
                  // `snap-start` over the base `snap-center`: a slide is now
                  // shorter than the viewport, so centring it would park it
                  // mid-window instead of under the header.
                  NATIVE_ENGINE && 'md:h-(--gallery-slide) md:basis-auto md:snap-start',
                )}
              >
                <div className='relative size-full'>{renderImage(image, index)}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {badge && (
          <div
            data-gallery-badge
            className={cn(
              'absolute top-3 left-7 md:left-4',
              // Same 16px below the photo's box as before: the stage now
              // starts higher, so the badge rides down by the stage's raise.
              underHeader
                ? 'md:top-[calc(--spacing(4)+var(--gallery-under-header-offset))]'
                : 'md:top-4',
            )}
          >
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
