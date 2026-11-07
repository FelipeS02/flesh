'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { type ImageView, mediaSource } from '@/modules/catalog/client';

/** The design's desktop slide width; `sizes` below follows it. */
const SLIDE_WIDTH = 520;

/** Same reasoning as the buy gallery's hero: the original is downscaled by Next. */
const QUALITY = 90;

type PreviewCarouselProps = {
  images: ImageView[];
  title: string;
  /** Rendered by the page so the badge copy stays on the server. */
  badge?: ReactNode;
};

/**
 * The teaser's centred carousel: one active slide with its neighbours peeking
 * at the sides, faded to .35.
 *
 * Built on `ui/carousel` (Embla) rather than the buy gallery's native scroller:
 * the design needs the active slide centred with the others parked beside it,
 * and arrow buttons that move it, which is what Embla's `align: 'center'` and
 * `scrollPrev/Next` give for free. The buy gallery's argument against Embla
 * (it never moved anything there) does not apply: here it is the whole gesture.
 */
export function PreviewCarousel({ images, title, badge }: PreviewCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  // `position` is the wire's ordering field; the array order is incidental.
  const ordered = [...images].toSorted((a, b) => a.position - b.position);
  const hasControls = ordered.length > 1;

  useEffect(() => {
    if (!api) return;

    const sync = () => setSelected(api.selectedScrollSnap());
    sync();
    api.on('select', sync);
    api.on('reInit', sync);

    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api]);

  const atStart = selected <= 0;
  const atEnd = selected >= ordered.length - 1;

  return (
    <div className='relative w-full'>
      <Carousel
        setApi={setApi}
        // `containScroll: false` lets the first and last slides sit in the
        // middle instead of being pinned to the viewport edge, which is what
        // keeps the active slide centred whichever one it is.
        opts={{ align: 'center', containScroll: false }}
        aria-label={`Galería de imágenes de ${title}`}
      >
        {/* The design has a 14px gap between slides on mobile and 40px on
            desktop. Each item carries it as left padding (the primitive's
            gutter), so the basis is the slide plus that gap. */}
        <CarouselContent className='-ml-3.5 md:-ml-10'>
          {ordered.map((image, index) => {
            const source = mediaSource(image.src, { width: SLIDE_WIDTH });
            const active = index === selected;

            return (
              <CarouselItem
                key={image.id}
                aria-label={`Imagen ${index + 1} de ${ordered.length}`}
                data-active={active ? '' : undefined}
                className={cn(
                  'basis-[284px] pl-3.5 transition-opacity duration-300 md:basis-[560px] md:pl-10 motion-reduce:transition-none',
                  !active && 'opacity-35',
                )}
              >
                <div className='relative aspect-[520/672] w-full'>
                  <Image
                    src={source.src}
                    unoptimized={source.unoptimized}
                    alt={`${title} — imagen ${index + 1} de ${ordered.length}`}
                    fill
                    // Doubled on desktop for the same reason the buy gallery
                    // doubles it: a 1x display would otherwise be handed a
                    // candidate barely larger than the slide.
                    sizes='(min-width: 768px) 1040px, 540px'
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
      </Carousel>

      {badge && (
        <div className='pointer-events-none absolute top-0 left-[calc(50%-135px)] md:left-[calc(50%-260px)]'>
          {badge}
        </div>
      )}

      {hasControls && (
        <>
          {/* The primitive's own CarouselPrevious/Next are round and labelled
              in English, and this design is square and Spanish, so the design
              system's Button drives the same Embla API instead. They sit on
              the active slide's edges, 24px outside them and over the dimmed
              neighbours, hence the 332px (260 + 24 + 48) offsets from the centre. Hidden on mobile: there you swipe. */}
          <Button
            type='button'
            variant='ghost'
            size='icon-lg'
            aria-label='Imagen anterior'
            disabled={atStart}
            onClick={() => api?.scrollPrev()}
            className='absolute top-1/2 left-[calc(50%-332px)] z-10 hidden size-12 -translate-y-1/2 border-border bg-black/70 text-foreground hover:bg-black/70 md:inline-flex'
          >
            <ArrowLeftIcon className='size-5' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon-lg'
            aria-label='Imagen siguiente'
            disabled={atEnd}
            onClick={() => api?.scrollNext()}
            className='absolute top-1/2 right-[calc(50%-332px)] z-10 hidden size-12 -translate-y-1/2 border-border bg-black/70 text-foreground hover:bg-black/70 md:inline-flex'
          >
            <ArrowRightIcon className='size-5' />
          </Button>

          <ul className='flex items-center justify-center pt-[18px] pb-9 md:pt-6 md:pb-14'>
            {ordered.map((image, index) => {
              const active = index === selected;

              return (
                <li key={image.id}>
                  {/* The visible dash is 2px tall, far under a tappable size,
                      so the button is the hit area and the dash its child.
                      Its side padding is the gap between dashes (8 / 10). */}
                  <Button
                    type='button'
                    variant='ghost'
                    aria-current={active ? 'true' : undefined}
                    aria-label={`Ver imagen ${index + 1} de ${ordered.length}`}
                    onClick={() => api?.scrollTo(index)}
                    className='h-6 px-1 hover:bg-transparent md:px-[5px]'
                  >
                    <span
                      aria-hidden='true'
                      className={cn(
                        'h-0.5 transition-[width,background-color] motion-reduce:transition-none',
                        active
                          ? 'w-[22px] bg-foreground md:w-7'
                          : 'w-2.5 bg-muted-foreground md:w-3.5',
                      )}
                    />
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
