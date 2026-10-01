"use client";

import { useEffect, type RefObject } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

/**
 * How much wheel travel counts as one gesture. A mouse notch reports around
 * 100px, so a notch is always one slide; a trackpad's stream of small deltas
 * has to add up first.
 */
export const WHEEL_THRESHOLD_PX = 14;

/**
 * The quiet period after a step, and the knob that controls how fluid the
 * wheel feels.
 *
 * It exists only to collapse ONE physical notch — which arrives as a burst
 * of events, and on a trackpad as a long momentum tail — into one step. It
 * is deliberately much shorter than embla's own transition: a notch landing
 * mid-animation makes embla re-target rather than restart, so a wheel spun
 * steadily produces continuous motion. Waiting for the animation to finish
 * (embla's `settle`) is what turns this into a stop-start slideshow.
 */
export const WHEEL_STEP_COOLDOWN_MS = 90;

/** Firefox reports whole lines. Roughly one line of body copy. */
const LINE_HEIGHT_PX = 16;

type WheelNavigationOptions = {
  api: CarouselApi;
  /** The element that owns the wheel — see the note on scope below. */
  target: RefObject<HTMLElement | null>;
  enabled: boolean;
};

function pixelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * LINE_HEIGHT_PX;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }

  return event.deltaY;
}

/**
 * Drives a carousel with the mouse wheel.
 *
 * Scope is the point of the design: the listener is bound to `target`, not
 * to the window or the document, so it only ever sees a wheel event while
 * the pointer is over that element. Every other section of the page keeps
 * its ordinary scrolling and never learns this hook exists.
 *
 * Two details that are not optional:
 *
 * A native listener with `{ passive: false }`, not React's `onWheel`. React
 * registers its root wheel listener as passive, so `preventDefault` from a
 * synthetic handler is ignored and the page scrolls anyway.
 *
 * The wheel is only claimed while there is somewhere to go. At either end
 * the handler returns without preventing the default, so continuing to
 * scroll moves the page — a reader heading for the size selector is not
 * trapped on the last photo.
 */
export function useWheelNavigation({ api, target, enabled }: WheelNavigationOptions) {
  useEffect(() => {
    const node = target.current;

    if (!api || !node || !enabled) return;

    let travelled = 0;
    let cooldown: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
      const delta = pixelDelta(event);

      // A horizontal or shift-modified wheel is somebody else's gesture.
      if (delta === 0) return;

      const forward = delta > 0;
      const canMove = forward ? api.canScrollNext() : api.canScrollPrev();

      if (!canMove) {
        travelled = 0;

        return;
      }

      event.preventDefault();

      if (cooldown) return;

      // A reversal is a new gesture, not a subtraction from the old one:
      // summing signed deltas would let a wobble cancel itself out, and
      // summing magnitudes would let it step in an arbitrary direction.
      travelled =
        Math.sign(travelled) === Math.sign(delta) ? travelled + delta : delta;

      if (Math.abs(travelled) < WHEEL_THRESHOLD_PX) return;

      travelled = 0;
      cooldown = setTimeout(() => {
        cooldown = undefined;
      }, WHEEL_STEP_COOLDOWN_MS);

      if (forward) api.scrollNext();
      else api.scrollPrev();
    };

    node.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      node.removeEventListener("wheel", onWheel);
      clearTimeout(cooldown);
    };
  }, [api, target, enabled]);
}
