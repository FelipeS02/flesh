'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { CarouselApi } from '@/components/ui/carousel';
import {
  MASK_STOP_AT_REST,
  maskStop,
  restingSlideVisualStates,
  slideVisualStates,
  type SlideVisualState,
} from './slide-blur';
import { useWheelNavigation } from './use-wheel-navigation';

type DesktopApi = NonNullable<CarouselApi>;

/**
 * The custom property the Embla desktop carousel's `mask-y-from-*` reads. It
 * is set on the stage rather than on the carousel because custom properties
 * inherit, and the stage is the node the gallery already holds a ref to.
 */
const MASK_STOP_PROPERTY = '--gallery-mask-stop';

function paintMaskStop(node: HTMLElement | null, stop: number): void {
  node?.style.setProperty(MASK_STOP_PROPERTY, `${stop}%`);
}

function clearDesktopStyles(api: CarouselApi): void {
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

type EmblaDesktopOptions = {
  api: CarouselApi;
  /** True only when the Embla engine is selected AND the viewport is desktop. */
  enabled: boolean;
  count: number;
  /** The last index an engine confirmed; the handoff aligns Embla to it. */
  selected: number;
  stage: RefObject<HTMLElement | null>;
  onSelect: (index: number) => void;
};

function clampIndex(index: number, count: number): number {
  if (count < 1) return 0;

  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * The controlled desktop engine: Embla owns the transform, the wheel steps
 * one slide per gesture, and scale/opacity/blur are painted per frame.
 *
 * Returns `select`, the thumbnail command. It is the gallery's only way in,
 * and it queues a command issued before Embla has published its API.
 */
export function useEmblaDesktop({
  api,
  enabled,
  count,
  selected,
  stage,
  onSelect,
}: EmblaDesktopOptions) {
  const pendingTarget = useRef<number | null>(null);

  useEffect(() => {
    if (!api || !enabled) return;

    const flushPendingTarget = () => {
      const target = pendingTarget.current;
      if (target === null) return false;

      pendingTarget.current = null;
      api.scrollTo(clampIndex(target, count));
      return true;
    };
    const sync = () => {
      if (flushPendingTarget()) return;

      onSelect(clampIndex(api.selectedScrollSnap(), count));
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
  }, [api, enabled, count]);

  // Leaving desktop invalidates commands queued for the desktop engine while
  // it was active — the engine itself stays mounted, only inactive.
  useEffect(() => {
    if (!enabled) pendingTarget.current = null;
  }, [enabled]);

  // Per-frame style work stays outside React: scroll events only paint the
  // controlled desktop slide nodes and never re-render the gallery.
  useEffect(() => {
    if (!api || !enabled) {
      clearDesktopStyles(api);
      paintMaskStop(stage.current, MASK_STOP_AT_REST);
      return;
    }

    const paintMoving = () => {
      const progress = api.scrollProgress();
      const total = api.slideNodes().length;

      paintDesktopStyles(api, slideVisualStates(progress, total));
      paintMaskStop(stage.current, maskStop(progress, total));
    };
    const paintResting = () => {
      paintDesktopStyles(
        api,
        restingSlideVisualStates(api.selectedScrollSnap(), api.slideNodes().length),
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
  }, [api, enabled, stage]);

  useWheelNavigation({ api, target: stage, enabled });

  return {
    select(index: number) {
      const next = clampIndex(index, count);

      if (api) api.scrollTo(next);
      else pendingTarget.current = next;
    },
  };
}
