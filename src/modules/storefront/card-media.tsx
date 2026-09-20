"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { type ImageView, mediaSource } from "@/modules/catalog/client";

/**
 * The width the card's photo is designed against.
 *
 * The slot is 301 CSS px on desktop and at most 384 on mobile (`max-w-sm`),
 * so 320 at 2x lands on the 640 derivative — an exact fit for desktop and
 * 83% of the pixels a 2x phone would ideally get. That shortfall is a
 * deliberate trade for the grid specifically: 640 WebP is ~10 KB against a
 * 1.4 MB original, and the landing renders a whole catalogue of these. The
 * PDP, which shows ONE photo large, makes the opposite call.
 */
const CARD_SLOT_WIDTH = 320;
const CARD_SLOT_DPR = 2;

/**
 * How far outside the viewport the observer commits to the fetch. The margin
 * IS the feature — it buys the request a head start so the photo has landed
 * by the time the card is actually on screen.
 */
const PRELOAD_MARGIN = "200px";

const CARD_SIZES = "(min-width: 768px) 301px, 100vw";

type CardMediaProps = {
  /** Ordered by `position` upstream; `[0]` is the cover, `[1]` the hover. */
  images: ImageView[];
  /**
   * Defer the fetch until the card approaches the viewport.
   *
   * Off by default because it is only ever a win below the fold, and the
   * component cannot tell where it was rendered.
   */
  observe?: boolean;
  /**
   * Above-the-fold cards. Bypasses `observe` entirely — see `gated` below.
   */
  priority?: boolean;
  /** Sold-out cards render their photo knocked back. */
  dimmed?: boolean;
};

/**
 * The photo half of a product card: the cover, the hover alternate, and the
 * loading behaviour that ties them together.
 *
 * Split out of `ProductCard` rather than turning that into a client
 * component. The card is otherwise entirely static — prices, swatches and
 * headings that react to nothing — and this is the only part of it that
 * needs the browser, so this is the only part that should cost a bundle.
 */
export function CardMedia({
  images,
  observe = false,
  priority = false,
  dimmed = false,
}: CardMediaProps) {
  const [cover, alternate] = images;

  // A priority image is the one the page's LCP is measured on. Putting it
  // behind an observer would delay the single fetch we most want early, to
  // save a request that was going to happen immediately anyway.
  const gated = observe && !priority;
  const [visible, setVisible] = useState(!gated);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gated || visible) return;

    const node = frame.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [gated, visible]);

  if (!cover) return null;

  return (
    // The sold-out knock-back lives HERE and not on the photos. `cn` is
    // twMerge, so an `opacity-40` sitting on the same element as the fade's
    // `opacity-0`/`opacity-100` wins outright — and a sold-out card would
    // fade to nothing and stay there. Dimming the frame composes instead of
    // competing.
    <div
      ref={frame}
      data-card-media
      className={cn("absolute inset-0", dimmed && "opacity-40")}
    >
      {visible && (
        <>
          <CardPhoto
            image={cover}
            // Eagerness is a property of the CARD, not of one photo: whether
            // WE decided to mount it is the same answer for both.
            eager={gated || priority}
            priority={priority}
            // Only fades out under a real pointer: Tailwind wraps `hover:` in
            // `@media (hover: hover)`, so a tap can never leave the cover
            // hidden with nothing to bring it back.
            className={cn(alternate && "group-hover:opacity-0")}
          />

          {alternate && (
            <CardPhoto
              image={alternate}
              // Eager for the same reason as the cover — and NOT `priority`,
              // so it is never put in the head. It shares the cover's box, so
              // on an above-the-fold card it is already inside the viewport:
              // native lazy defers nothing there, it only strips the fetch of
              // its priority signal and leaves the browser free to measure the
              // LCP on a photo nothing was warming.
              eager={gated || priority}
              // The alternate opts out of the fade. Its reveal is the hover
              // transition, and running a load fade underneath would mean the
              // first hover cross-fades against a half-faded image.
              revealOnHover
            />
          )}
        </>
      )}
    </div>
  );
}

type CardPhotoProps = {
  image: ImageView;
  /** Something other than the browser already decided to fetch this. */
  eager: boolean;
  priority?: boolean;
  /** Sit hidden and appear on the group's hover, instead of fading in on load. */
  revealOnHover?: boolean;
  className?: string;
};

function CardPhoto({
  image,
  eager,
  priority = false,
  revealOnHover = false,
  className,
}: CardPhotoProps) {
  const [loaded, setLoaded] = useState(false);
  const source = mediaSource(image.src, {
    width: CARD_SLOT_WIDTH,
    dpr: CARD_SLOT_DPR,
  });

  // A cached image can finish decoding before React attaches `onLoad`, and
  // the event never replays — the photo would sit at opacity 0 for good, on
  // exactly the second visit where it should appear fastest. Reading
  // `complete` as the node attaches is the only moment that race is visible.
  const settleIfCached = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);

  return (
    <Image
      ref={settleIfCached}
      src={source.src}
      unoptimized={source.unoptimized}
      alt=""
      fill
      sizes={CARD_SIZES}
      // Next 16 deprecated `priority` in favour of `preload`; they do the same
      // thing and passing BOTH throws. The component's own prop keeps the name
      // `priority` because it answers a layout question — is this card above
      // the fold — while `preload` is the mechanism that answers it.
      preload={priority}
      // `loading` and the observer are two lazy strategies, and stacking them
      // cancels the one that was asked for. The observer fires PRELOAD_MARGIN
      // BEFORE the card reaches the viewport, so the <img> mounts while still
      // off-screen — and native `loading="lazy"` would then re-defer it
      // against the browser's own threshold, spending the head start on a
      // second wait. Once the observer has decided, it IS the lazy strategy,
      // so the tag goes eager. Photos nothing else is deferring keep native
      // lazy, which is the right default for them.
      loading={eager ? "eager" : "lazy"}
      // The hover photo is speculative — the shopper may never point at this
      // card — so it states its own lane rather than bidding at the default
      // against the cover it is hiding behind. Same call the PDP gallery
      // makes for its lookahead slides.
      fetchPriority={revealOnHover ? "low" : undefined}
      onLoad={() => setLoaded(true)}
      data-loaded={loaded ? "true" : "false"}
      className={cn(
        "object-contain transition-[filter,opacity] duration-300 ease-out motion-reduce:transition-none",
        revealOnHover
          ? "opacity-0 blur-xs group-hover:opacity-100 group-hover:blur-none"
          : loaded
            ? "opacity-100"
            : "opacity-0",
        className,
      )}
    />
  );
}
