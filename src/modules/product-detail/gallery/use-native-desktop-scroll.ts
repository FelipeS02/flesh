'use client';

import { useEffect, type RefObject } from 'react';
import {
  HEADER_SCROLL_RANGE,
  UNDER_HEADER_PROGRESS_PROPERTY,
} from '@/components/shared/header-scroll';
import { DESKTOP_GALLERY_UNDER_HEADER } from './gallery-config';
import { nativeScrollPosition, nativeSlideBlurs } from './slide-blur';

/**
 * The room under the last slide. The stylesheet defines a default for it
 * (visible stage minus the fallback slide height); this overrides it with the
 * real one once the last photo's height is known.
 */
const PEEK_STRIP_PROPERTY = '--gallery-peek-strip';

/**
 * Where each slide's top is, in scroll offsets: the `scrollTop` that parks
 * that slide, so the first is always 0.
 *
 * Read per slide from its layout box (`offsetTop`, which is relative to the
 * scroller because the scroller is positioned), never from computed style,
 * which would force a style recalculation on every scroll frame. Slides take
 * their own photo's height now, so there is no single pitch to multiply by,
 * and the gap between them is whatever CSS says, never a number written down
 * twice here. Subtracting the first slide's top removes the header padding the
 * content starts below.
 *
 * No top is past the end of the scroll. A short last slide ends centred (see
 * `paintPeekStrip`), so the scroller stops before its top: that end is where
 * it parks, or it would never be selected, come into focus, or be reached by
 * its thumbnail.
 *
 * Unmeasured slides (display:none, jsdom) all report the same top, and then
 * the tops fall back to one viewport apart, which is exactly right when there
 * is no padding and every slide fills the viewport.
 */
export function slideTops(node: HTMLElement): number[] {
  const slides = slideNodes(node);
  const first = slides[0]?.offsetTop ?? 0;
  const tops = slides.map((slide) => slide.offsetTop - first);

  if (!(tops.length > 1 && tops[1]! > 0)) {
    return slides.map((_, index) => index * node.clientHeight);
  }

  // An unmeasured scroller reports no overflow; clamping to it would collapse
  // every top onto 0.
  const end = node.scrollHeight - node.clientHeight;
  return end > 0 ? tops.map((top) => Math.min(top, end)) : tops;
}

/**
 * Scrolls a native scroller so slide `index` is parked, along the given axis.
 *
 * Mobile scrolls horizontally, one viewport width per slide. Desktop scrolls
 * vertically to that slide's own top. `scrollTo` is missing in some
 * environments, hence the direct assignment fallback.
 */
export function scrollToSlide(
  node: HTMLElement | null,
  index: number,
  vertical: boolean,
  behavior: ScrollBehavior,
): void {
  if (!node) return;

  const offset = vertical
    ? (slideTops(node)[index] ?? 0)
    : index * node.clientWidth;
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

/**
 * Sizes the room under the last slide, from the visible stage (the viewport
 * minus the header padding above the first slide) and that slide's height.
 *
 * Parking a short last photo (a banner) at the top like the others left a
 * tall empty band under it, so it ends centred instead: half the spare room.
 * Never less than the peek strip, though, or a nearly full-height photo would
 * end lower than every other slide parks; and never more than parking at the
 * top needs, nor negative.
 *
 * It cannot be a CSS `calc`: it depends on the last photo's height, which is
 * its aspect ratio times the stage width. An unmeasured last slide leaves the
 * stylesheet's default in place instead.
 */
function paintPeekStrip(
  stage: HTMLElement | null,
  viewport: HTMLElement,
  slides: HTMLElement[],
  peek: number,
): void {
  const first = slides[0];
  const last = slides.at(-1);

  if (!stage || !first || !last || last.offsetHeight <= 0) {
    stage?.style.removeProperty(PEEK_STRIP_PROPERTY);
    return;
  }

  const visible = viewport.clientHeight - first.offsetTop;
  const spare = visible - last.offsetHeight;
  const room = Math.min(spare, Math.max(spare / 2, visible * peek));
  stage.style.setProperty(PEEK_STRIP_PROPERTY, `${Math.max(room, 0)}px`);
}

type NativeDesktopScrollOptions = {
  /** The scroll container: the horizontal mobile scroller, vertical on desktop. */
  viewport: RefObject<HTMLElement | null>;
  stage: RefObject<HTMLElement | null>;
  /** True only on the desktop layout; mobile paints nothing. */
  enabled: boolean;
  count: number;
  /** The fraction of the stage the next slide peeks into, already clamped. */
  peek: number;
};

/**
 * Paints the desktop gallery's per-slide blur, the room under its last slide
 * and the header backdrop's progress from the viewport's scroll position.
 *
 * This stays outside React: scroll events only write styles onto nodes and
 * never re-render the gallery. Writes are coalesced to one per animation frame, because a wheel or trackpad fires scroll events
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
  peek,
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
      const position = nativeScrollPosition(node.scrollTop, slideTops(node));
      const blurs = nativeSlideBlurs(position, nodes.length);

      nodes.forEach((slide, index) => {
        const blur = blurs[index] ?? 0;
        // Empty rather than `blur(0px)`: a zero-radius filter still promotes
        // the photo to its own layer, which leaves a parked slide soft.
        slide.style.filter = blur === 0 ? '' : `blur(${blur}px)`;
      });
      paintPeekStrip(stage.current, node, nodes, peek);

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
      stageNode?.style.removeProperty(PEEK_STRIP_PROPERTY);
      // A stale value would leave the header backdrop showing over a page the
      // gallery no longer scrolls behind.
      document.documentElement.style.removeProperty(UNDER_HEADER_PROGRESS_PROPERTY);
    };
  }, [enabled, count, peek, viewport, stage]);
}
