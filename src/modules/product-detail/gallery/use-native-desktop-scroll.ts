'use client';

import { useEffect, type RefObject } from 'react';
import {
  HEADER_SCROLL_RANGE,
  UNDER_HEADER_PROGRESS_PROPERTY,
} from '@/components/shared/header-scroll';
import { DESKTOP_EDGE_FADE_STOP, DESKTOP_GALLERY_UNDER_HEADER } from './gallery-config';
import {
  MASK_STOP_AT_REST,
  edgeMaskStops,
  nativeScrollPosition,
  nativeSlideBlurs,
} from './slide-blur';

/**
 * The stage height `DESKTOP_EDGE_FADE_STOP` was tuned against (`45.125rem`, the
 * minimum visible stage). Its fade depth in pixels is what stays constant.
 */
const EDGE_FADE_REFERENCE_PX = 722;

/**
 * The custom properties the gallery region's independent `mask-t-from-*` /
 * `mask-b-from-*` read. Set on the stage rather than on the region because
 * custom properties inherit, and the stage is the node the gallery already
 * holds a ref to.
 */
const MASK_TOP_PROPERTY = '--gallery-mask-top';
const MASK_BOTTOM_PROPERTY = '--gallery-mask-bottom';

/**
 * The distance one slide occupies along the scroll axis.
 *
 * Horizontally that is the viewport's width. Vertically it cannot be
 * `clientHeight`: under the header the viewport is taller than a slide by the
 * header offset (it carries that much padding), so the slide's OWN height is
 * the unit. Read from the first slide's layout box rather than computed style,
 * which would force a style recalculation on every scroll frame; slides are
 * all one size. `clientHeight` is the fallback for an unmeasured slide, and
 * is exactly right when there is no padding.
 *
 * With a gap between slides the unit is the PITCH, not the height: slide `i`
 * starts at `i * (height + gap)`, and dividing by the height alone drifts by
 * one gap per slide, so a parked photo would read as part-way to the next and
 * keep a blur. The pitch is read as the second slide's offset from the first
 * — the gap is whatever CSS says, never a number written down twice here.
 */
export function scrollUnit(node: HTMLElement, vertical: boolean): number {
  if (!vertical) return node.clientWidth;

  const first = node.firstElementChild?.firstElementChild;
  const second = first?.nextElementSibling;
  const pitch =
    first instanceof HTMLElement && second instanceof HTMLElement
      ? second.offsetTop - first.offsetTop
      : 0;
  if (pitch > 0) return pitch;

  const height = first instanceof HTMLElement ? first.offsetHeight : 0;

  return height > 0 ? height : node.clientHeight;
}

/**
 * Scrolls a native scroller so slide `index` fills it, along the given axis.
 *
 * Both layouts need this — mobile scrolls horizontally, desktop vertically —
 * and in both the offset of slide `index` is `index * scrollUnit`. `scrollTo`
 * is missing in some environments, hence the direct assignment fallback.
 */
export function scrollToSlide(
  node: HTMLElement | null,
  index: number,
  vertical: boolean,
  behavior: ScrollBehavior,
): void {
  if (!node) return;

  const offset = index * scrollUnit(node, vertical);
  if (typeof node.scrollTo === 'function') {
    node.scrollTo(vertical ? { top: offset, behavior } : { left: offset, behavior });
  } else if (vertical) {
    node.scrollTop = offset;
  } else {
    node.scrollLeft = offset;
  }
}

function slideNodes(viewport: HTMLElement): HTMLElement[] {
  // The viewport's only child is the flex track holding the slides.
  return Array.from((viewport.firstElementChild?.children ?? []) as Iterable<HTMLElement>);
}

function paintMasks(stage: HTMLElement | null, top: number, bottom: number): void {
  stage?.style.setProperty(MASK_TOP_PROPERTY, `${top}%`);
  stage?.style.setProperty(MASK_BOTTOM_PROPERTY, `${bottom}%`);
}

type NativeDesktopScrollOptions = {
  /** The scroll container: the horizontal mobile scroller, vertical on desktop. */
  viewport: RefObject<HTMLElement | null>;
  stage: RefObject<HTMLElement | null>;
  /** True only on the desktop layout; mobile paints nothing. */
  enabled: boolean;
  count: number;
};

/**
 * Paints the desktop gallery's per-slide blur and its two edge fades from the
 * viewport's scroll position.
 *
 * This stays outside React: scroll events only write styles onto nodes and
 * never re-render the gallery. Writes are coalesced to
 * one per animation frame, because a wheel or trackpad fires scroll events
 * faster than the display can show the result.
 *
 * Only blur is painted. The previous carousel also scaled and faded the
 * off-stage slides, which was dropped on purpose: with free scrolling a scaled
 * slide is shorter than its slot and opens a gap between two photos.
 *
 * Selection is NOT handled here. It is the same observation the mobile
 * scroller makes, only on the other axis, so the gallery does both in one
 * place.
 */
export function useNativeDesktopScroll({
  viewport,
  stage,
  enabled,
  count,
}: NativeDesktopScrollOptions) {
  useEffect(() => {
    const node = viewport.current;
    // A disabled run paints nothing. What a previously enabled run painted
    // was already taken back off by its own cleanup.
    if (!node || !enabled) return;

    let frame = 0;

    const paint = () => {
      frame = 0;

      const nodes = slideNodes(node);
      const unit = scrollUnit(node, true);
      const position = nativeScrollPosition(node.scrollTop, unit);
      const blurs = nativeSlideBlurs(position, nodes.length);
      // The mask is a percentage of the carousel box, which is taller than the
      // stage the depth was tuned against (the header offset) and grows with
      // the window. Scaling by that fixed reference holds the fade at the same
      // PIXEL depth at the bottom edge instead of deepening with the box.
      const scale =
        node.clientHeight > 0 ? Math.min(EDGE_FADE_REFERENCE_PX / node.clientHeight, 1) : 1;
      const fullStop = MASK_STOP_AT_REST - (MASK_STOP_AT_REST - DESKTOP_EDGE_FADE_STOP) * scale;
      const stops = edgeMaskStops(position, nodes.length, fullStop);

      nodes.forEach((slide, index) => {
        const blur = blurs[index] ?? 0;
        // Empty rather than `blur(0px)`: a zero-radius filter still promotes
        // the photo to its own layer, which leaves a parked slide soft.
        slide.style.filter = blur === 0 ? '' : `blur(${blur}px)`;
      });
      paintMasks(stage.current, stops.top, stops.bottom);

      // Only the backdrop follows the gallery; the logotype scale and marquee
      // collapse stay page-scroll, so the header does not shrink while the
      // page itself has not moved. Written on the root, which the header band
      // inherits from, rather than reaching into the header.
      if (DESKTOP_GALLERY_UNDER_HEADER) {
        const progress = Math.min(Math.max(node.scrollTop / HEADER_SCROLL_RANGE, 0), 1);

        document.documentElement.style.setProperty(
          UNDER_HEADER_PROGRESS_PROPERTY,
          String(Number.isFinite(progress) ? progress : 0),
        );
      }
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
      // A stale value would leave the header backdrop showing over a page the
      // gallery no longer scrolls behind.
      document.documentElement.style.removeProperty(UNDER_HEADER_PROGRESS_PROPERTY);
    };
  }, [enabled, count, viewport, stage]);
}
