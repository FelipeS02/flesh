"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { ImageView } from "@/modules/catalog/client";
import { slideBlurValues } from "./slide-blur";
import { useWheelNavigation } from "./use-wheel-navigation";

/** The `md` breakpoint, spelled the way Tailwind spells it. */
const DESKTOP_QUERY = "(min-width: 768px)";

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
export function ProductGallery({ images, title, badge, dimmed }: ProductGalleryProps) {
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
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
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

    const paint = () => {
      const slides = api.slideNodes();
      const blurs = slideBlurValues(api.scrollProgress(), slides.length);

      slides.forEach((slide, index) => {
        slide.style.filter = `blur(${blurs[index]}px)`;
      });
    };

    paint();
    api.on("scroll", paint);
    // Both ends of a motion, because `scroll` stops one frame short of the
    // resting position often enough to leave a sliver of blur on the photo.
    api.on("settle", paint);
    // The axis swap at `md` re-measures every snap, so yesterday's progress
    // describes nothing.
    api.on("reInit", paint);

    return () => {
      api.off("scroll", paint);
      api.off("settle", paint);
      api.off("reInit", paint);
    };
  }, [api]);

  // Desktop only: the wheel is a mouse, and the vertical axis is the one it
  // reads as "next photo". A phone scrolls the page with the same gesture.
  useWheelNavigation({ api, target: stage, enabled: isDesktop });

  const orientation = isDesktop ? "vertical" : "horizontal";

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
    <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
      {/* 560px is the artboard's stage width at a 1440 viewport, so it is a
          CEILING, not a fixed size: on any narrower desktop the two-column PDP
          has less than 1296px to divide between gallery and panel, and a rigid
          stage would push the purchase panel off the right edge. */}
      <div
        ref={stage}
        data-gallery-stage
        data-orientation={orientation}
        className="relative w-full md:max-w-140 md:min-w-0 md:flex-1"
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
          className={cn("w-full", dimmed && "opacity-40")}
        >
          {/* The height lives on the TRACK, not on a wrapper: embla measures
              the overflow container, and that container takes its height from
              this element. A vertical carousel with an auto-height viewport
              has nothing to scroll within. */}
          <CarouselContent className="mt-0 ml-0 h-75 md:h-180.5">
            {ordered.map((image, index) => (
              <CarouselItem key={image.id} className="pt-0 pl-0">
                <div className="relative size-full">
                  {/* `object-contain`: the artboard fits the garment inside
                      the stage rather than cropping it. */}
                  <Image
                    src={image.src}
                    alt={`${title} — imagen ${index + 1} de ${ordered.length}`}
                    fill
                    sizes="(min-width: 768px) 560px, 100vw"
                    className="object-contain"
                    // `priority` is deprecated as of Next 16 (see
                    // `docs/.../image.md#priority`). The first slide is the
                    // PDP's LCP element, and the docs prefer `loading="eager"`
                    // over `preload` for an element the markup already
                    // discovers this early.
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {badge && (
          <div data-gallery-badge className="absolute top-3 left-3 md:top-4 md:left-4">
            {badge}
          </div>
        )}

        {/* Mobile only, by CSS. Desktop needs no counter because the rail
            beside the photo already shows which image is on screen — on a
            phone the rail is below the fold of the stage. */}
        {hasRail && (
          <p
            aria-hidden="true"
            className="absolute top-2 right-2 rounded-full bg-black/80 px-2 py-0.5 font-sans text-[11px] text-foreground md:hidden"
          >
            {selectedIndex + 1} / {ordered.length}
          </p>
        )}
      </div>

      {/* Last in the DOM so the photo is what a screen reader reaches first;
          `md:order-first` is what moves the rail to the left on desktop. */}
      {hasRail && (
        <ul className="flex shrink-0 gap-1.5 md:order-first md:flex-col md:gap-2">
          {ordered.map((image, index) => {
            const active = index === selectedIndex;

            return (
              <li key={image.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Ver imagen ${index + 1} de ${ordered.length}`}
                  onClick={() => select(index)}
                  className={cn(
                    "relative block h-15.5 w-14 overflow-hidden border border-transparent transition-[border-color,opacity,filter] md:h-18 md:w-16",
                    active ? "border-foreground" : "opacity-50",
                  )}
                >
                  {/* Decorative: the button's label already says which image
                      this is, so announcing the garment again would read the
                      same product five times over. */}
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
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
