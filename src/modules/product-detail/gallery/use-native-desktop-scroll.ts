'use client';

import { useEffect, type RefObject } from 'react';
import type { CarouselApi } from '@/components/ui/carousel';
import {
  MASK_STOP_AT_REST,
  edgeMaskStops,
  nativeScrollPosition,
  nativeSlideBlurs,
} from './slide-blur';

/**
 * The custom properties the native desktop carousel's independent
 * `mask-t-from-*` / `mask-b-from-*` read. Set on the stage rather than on the
 * carousel for the same reason the Embla engine does it: custom properties
 * inherit, and the stage is the node the gallery already holds a ref to.
 */
const MASK_TOP_PROPERTY = '--gallery-mask-top';
const MASK_BOTTOM_PROPERTY = '--gallery-mask-bottom';

/**
 * Scrolls a native scroller so slide `index` fills it, along the given axis.
 *
 * Both layouts need this — mobile scrolls horizontally, the native desktop
 * engine vertically — and in both the slide is exactly one viewport wide or
 * tall, so the offset is `index * clientSize`. `scrollTo` is missing in some
 * environments (and old engines), hence the direct assignment fallback.
 */
export function scrollToSlide(
  node: HTMLElement | null,
  index: number,
  vertical: boolean,
  behavior: ScrollBehavior,
): void {
  if (!node) return;

  const offset = index * (vertical ? node.clientHeight : node.clientWidth);
  if (typeof node.scrollTo === 'function') {
    node.scrollTo(vertical ? { top: offset, behavior } : { left: offset, behavior });
  } else if (vertical) {
    node.scrollTop = offset;
  } else {
    node.scrollLeft = offset;
  }
}

function slideNodes(viewport: HTMLElement): HTMLElement[] {
  // The viewport's only child is the flex track holding the slides. Read from
  // the DOM rather than from Embla: this engine must not depend on an inactive
  // Embla instance answering `slideNodes()`.
  return Array.from((viewport.firstElementChild?.children ?? []) as Iterable<HTMLElement>);
}

function paintMasks(stage: HTMLElement | null, top: number, bottom: number): void {
  stage?.style.setProperty(MASK_TOP_PROPERTY, `${top}%`);
  stage?.style.setProperty(MASK_BOTTOM_PROPERTY, `${bottom}%`);
}

type NativeDesktopScrollOptions = {
  /** Only a dependency: the viewport node exists once Embla has built. */
  api: CarouselApi;
  /** The Embla viewport, which is the desktop scroll container in this engine. */
  viewport: RefObject<HTMLElement | null>;
  stage: RefObject<HTMLElement | null>;
  /** True only when the native engine is selected AND the viewport is desktop. */
  enabled: boolean;
  count: number;
};

/**
 * Paints the native desktop engine's per-slide blur and its two edge fades
 * from the viewport's scroll position.
 *
 * Like the Embla engine this stays outside React: scroll events only write
 * styles onto nodes and never re-render the gallery. Writes are coalesced to
 * one per animation frame, because a wheel or trackpad fires scroll events
 * faster than the display can show the result.
 *
 * Only blur is painted. The Embla engine also scaled and faded the off-stage
 * slides, which are dropped here on purpose: with free scrolling a scaled
 * slide is shorter than its slot and opens a gap between two photos.
 *
 * Selection is NOT handled here. It is the same observation the mobile
 * scroller makes, only on the other axis, so the gallery does both in one
 * place.
 */
export function useNativeDesktopScroll({
  api,
  viewport,
  stage,
  enabled,
  count,
}: NativeDesktopScrollOptions) {
  useEffect(() => {
    const node = viewport.current;
    // A disabled run touches nothing: the Embla engine may own these slide
    // nodes' styles, and clearing them from here would wipe its paint.
    if (!node || !enabled) return;

    let frame = 0;

    const paint = () => {
      frame = 0;

      const nodes = slideNodes(node);
      const position = nativeScrollPosition(node.scrollTop, node.clientHeight);
      const blurs = nativeSlideBlurs(position, nodes.length);
      const stops = edgeMaskStops(position, nodes.length);

      nodes.forEach((slide, index) => {
        const blur = blurs[index] ?? 0;
        // Empty rather than `blur(0px)`: a zero-radius filter still promotes
        // the photo to its own layer, which leaves a parked slide soft.
        slide.style.filter = blur === 0 ? '' : `blur(${blur}px)`;
      });
      paintMasks(stage.current, stops.top, stops.bottom);
    };
    const schedule = () => {
      if (frame) return;

      frame = requestAnimationFrame(paint);
    };

    paint();
    node.addEventListener('scroll', schedule, { passive: true });
    // A resize changes the slide height, and so the position a given
    // scrollTop means, without any scroll event to report it.
    window.addEventListener('resize', schedule);

    const stageNode = stage.current;

    return () => {
      node.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      slideNodes(node).forEach((slide) => {
        slide.style.filter = '';
      });
      paintMasks(stageNode, MASK_STOP_AT_REST, MASK_STOP_AT_REST);
    };
  }, [api, enabled, count, viewport, stage]);
}
