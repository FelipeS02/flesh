'use client';

import {
  useCallback,
  useEffect,
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
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { type ImageView, mediaSource } from '@/modules/catalog/client';
import { GalleryThumbnails } from '../gallery/gallery-thumbnails';
import { nativeSlideBlurs, nativeSlideOpacities } from '../gallery/slide-blur';

const DESKTOP_QUERY = '(min-width: 768px)';

/** The ratio of a photo that could not be measured: the design's 310x400 slide. */
const FALLBACK_RATIO = '310 / 400';

/** Same reasoning as the buy gallery's hero: the original is downscaled by Next. */
const QUALITY = 90;

function ratioOf(image: ImageView): string {
  return image.width && image.height ? `${image.width} / ${image.height}` : FALLBACK_RATIO;
}

/** The same ratio as a number, for the `calc()` that sizes the stage overlay. */
function numericRatio(image: ImageView | undefined): number {
  return image?.width && image.height ? image.width / image.height : 310 / 400;
}

type PreviewGalleryProps = {
  images: ImageView[];
  title: string;
  /** Rendered by the page so the badge copy stays on the server. */
  badge?: ReactNode;
};

/**
 * The preview PDP's gallery: on desktop a centred carousel (the active photo
 * in the middle, its neighbours parked beside it, blurred and faded), on
 * mobile a native scroll-snap strip. One tree for both, so the server-painted
 * first photo is the LCP node on either viewport and nothing remounts across
 * the breakpoint.
 *
 * Embla only runs from `md` up (`active: false` below): on mobile the
 * browser's own scroll-snap owns the gesture, as in the buy gallery, and an
 * engine that moves nothing there would only fight it by writing transforms.
 *
 * Every slide is as tall as the stage and as wide as ITS photo, from the
 * catalogue's measured dimensions, so portrait and landscape shots are never
 * letterboxed. Blur and fade come from the buy gallery's own curve
 * (`slide-blur`), so both galleries soften a neighbour the same way.
 */
export function PreviewGallery({ images, title, badge }: PreviewGalleryProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  // `position` is the wire's ordering field; the array order is incidental.
  const ordered = [...images].toSorted((a, b) => a.position - b.position);
  const count = ordered.length;
  const hasControls = count > 1;

  useEffect(() => {
    if (!api || !isDesktop) return;

    const sync = () => setSelected(api.selectedScrollSnap());
    sync();
    api.on('select', sync);
    api.on('reInit', sync);

    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api, isDesktop]);

  const viewport = useCallback(
    () => root.current?.querySelector<HTMLElement>('[data-slot="carousel-content"]') ?? null,
    [],
  );

  // Below md the browser scrolls, so the selection is observed: the slide
  // whose centre is nearest the strip's centre. Observation only, like the
  // buy gallery: correcting a gesture in flight fights its momentum.
  useEffect(() => {
    const node = viewport();
    if (!node || isDesktop) return;

    const onScroll = () => {
      const middle = node.scrollLeft + node.clientWidth / 2;
      const items = Array.from(node.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'));
      let best = 0;
      let bestDistance = Infinity;

      items.forEach((item, index) => {
        const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      setSelected(best);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [isDesktop, viewport]);

  function select(index: number) {
    if (isDesktop) {
      api?.scrollTo(index);
      return;
    }

    viewport()
      ?.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]')
      [index]?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setSelected(index);
  }

  const blurs = nativeSlideBlurs(selected, count);
  const opacities = nativeSlideOpacities(selected, count);

  return (
    <div
      ref={root}
      className='relative w-full md:[--preview-h:min(400px,max(240px,calc(var(--pdp-viewport-height,100svh)-var(--pdp-band-height,11.25rem)-344px)))]'
      style={{ '--first-ratio': ordered[0] ? ratioOf(ordered[0]) : FALLBACK_RATIO } as CSSProperties}
    >
      <Carousel
        setApi={setApi}
        opts={{ align: 'center', containScroll: false, active: isDesktop }}
        aria-label={`Galería de imágenes de ${title}`}
      >
        <CarouselContent
          viewportClassName='max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:scrollbar-none [&::-webkit-scrollbar]:hidden'
          // Before Embla starts (the server render, the first paint) the
          // track is nudged so the first photo already sits in the middle; the
          // engine's own inline transform replaces this the moment it runs,
          // so there is no jump. It is a `transform`, not Tailwind's `translate`
          // property, precisely so Embla's replaces it instead of adding to it.
          className='ml-0 gap-3.5 md:gap-10 md:[transform:translateX(calc(50vw-var(--preview-h)*var(--first-ratio)/2))]'
        >
          {ordered.map((image, index) => {
            const source = mediaSource(image.src, { width: 640 });

            return (
              <CarouselItem
                key={image.id}
                aria-label={`Imagen ${index + 1} de ${count}`}
                style={
                  {
                    '--slide-ratio': ratioOf(image),
                    filter: `blur(${blurs[index] ?? 0}px)`,
                    opacity: opacities[index] ?? 1,
                  } as CSSProperties
                }
                // The first and last slide get the margin that lets them reach
                // the middle of the native strip (half the viewport less half
                // the slide: 388px tall, so 194px x ratio).
                className='relative basis-auto pl-0 transition-[filter,opacity] duration-300 max-md:snap-center max-md:first:ml-[calc(50vw-194px*var(--slide-ratio))] max-md:last:mr-[calc(50vw-194px*var(--slide-ratio))] motion-reduce:transition-none'
              >
                <div className='relative h-97 aspect-(--slide-ratio) md:h-(--preview-h)'>
                  <Image
                    src={source.src}
                    unoptimized={source.unoptimized}
                    alt={`${title} — imagen ${index + 1} de ${count}`}
                    fill
                    sizes='(min-width: 768px) 800px, 700px'
                    quality={QUALITY}
                    className='object-cover'
                    // Only the first slide is the LCP candidate. React's server
                    // renderer already preloads every eager <img>; the lever is
                    // the lane, so `high` goes to slide one and the rest stay
                    // out of its way.
                    fetchPriority={index === 0 ? 'high' : 'low'}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {/* Badge and arrows are drawn ONCE, over the stage, not inside
            whichever slide is active: moving between slides then re-renders
            nothing here and remounts nothing, which an in-slide copy would do
            on every step. The layer sits where the active slide sits (centred
            by Embla on desktop, by scroll-snap on mobile) and is as wide as
            that slide, from the catalogue's measured ratio, so each arrow
            still covers half of the photo. The layer is click-through; only
            the arrows take pointer events. */}
        <div
          data-stage-overlay
          style={{ '--active-ratio': numericRatio(ordered[selected]) } as CSSProperties}
          className='pointer-events-none absolute top-0 left-1/2 z-10 h-97 w-[calc(388px*var(--active-ratio))] -translate-x-1/2 transition-[width] duration-300 md:h-(--preview-h) md:w-[calc(var(--preview-h)*var(--active-ratio))] motion-reduce:transition-none'
        >
          {badge && <div className='absolute top-0 left-0'>{badge}</div>}
          {hasControls && (
            <>
              <CarouselPrevious className='pointer-events-auto max-md:hidden' />
              <CarouselNext className='pointer-events-auto max-md:hidden' />
            </>
          )}
        </div>
      </Carousel>

      {hasControls && (
        <GalleryThumbnails
          images={ordered}
          selected={selected}
          onSelect={select}
          className='mt-3 flex justify-center gap-2 md:mt-4'
        />
      )}
    </div>
  );
}
