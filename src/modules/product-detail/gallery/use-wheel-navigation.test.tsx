import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  useWheelNavigation,
  WHEEL_STEP_COOLDOWN_MS,
  WHEEL_THRESHOLD_PX,
} from "./use-wheel-navigation";

/**
 * A hand-built stand-in rather than a real carousel: embla in jsdom measures
 * every slide at zero width, so its own `canScrollNext` is permanently false
 * and the hook's edge behaviour could never be exercised through it.
 */
function fakeCarousel() {
  const listeners = new Map<string, Set<() => void>>();

  const api = {
    scrollNext: vi.fn(),
    scrollPrev: vi.fn(),
    canScrollNext: vi.fn(() => true),
    canScrollPrev: vi.fn(() => true),
    on: vi.fn((event: string, listener: () => void) => {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(listener);
      listeners.set(event, bucket);

      return api;
    }),
    off: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);

      return api;
    }),
  };

  return {
    api: api as unknown as NonNullable<CarouselApi>,
    spies: api,
  };
}

/** Lets the step cooldown expire without waiting on a real clock. */
function elapse(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

function mount(api: CarouselApi, enabled = true) {
  function Host() {
    const ref = useRef<HTMLDivElement>(null);
    useWheelNavigation({ api, target: ref, enabled });

    return <div ref={ref} data-testid="stage" />;
  }

  const view = render(<Host />);

  return view.getByTestId("stage");
}

/** A real `WheelEvent`, because the hook reads `deltaMode` and cancellation. */
function wheel(target: Element, deltaY: number, deltaMode = 0) {
  const event = new WheelEvent("wheel", {
    deltaY,
    deltaMode,
    bubbles: true,
    cancelable: true,
  });

  target.dispatchEvent(event);

  return event;
}

const PAST_THRESHOLD = WHEEL_THRESHOLD_PX + 1;

describe("useWheelNavigation", () => {
  it("advances one slide per wheel gesture past the threshold", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, PAST_THRESHOLD);

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);
    expect(carousel.spies.scrollPrev).not.toHaveBeenCalled();
  });

  it("goes back when the wheel turns the other way", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, -PAST_THRESHOLD);

    expect(carousel.spies.scrollPrev).toHaveBeenCalledTimes(1);
  });

  // A trackpad emits a stream of small deltas rather than one notch.
  it("accumulates deltas too small to move on their own", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);
    const nudge = Math.ceil(WHEEL_THRESHOLD_PX / 3);

    wheel(stage, nudge);
    wheel(stage, nudge);

    expect(carousel.spies.scrollNext).not.toHaveBeenCalled();

    wheel(stage, nudge);
    wheel(stage, nudge);

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("drops an accumulation that reverses direction mid-stream", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);
    const nudge = Math.ceil(WHEEL_THRESHOLD_PX * 0.6);

    wheel(stage, nudge);
    wheel(stage, -nudge);

    // Had the two been summed the total would be zero; had they accumulated
    // by magnitude it would have stepped. Neither is a gesture.
    expect(carousel.spies.scrollNext).not.toHaveBeenCalled();
    expect(carousel.spies.scrollPrev).not.toHaveBeenCalled();
  });

  // One physical notch arrives as a burst of events. Without a cooldown the
  // burst reads as several gestures and the gallery flies past four photos.
  it("collapses a burst of events into a single step", () => {
    vi.useFakeTimers();
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, PAST_THRESHOLD);
    wheel(stage, PAST_THRESHOLD);
    wheel(stage, PAST_THRESHOLD);

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);
  });

  // The cooldown is deliberately far shorter than embla's own animation, so
  // a second notch lands mid-flight: embla re-targets rather than restarting,
  // and a reader spinning the wheel gets continuous motion instead of a
  // stop-start slideshow.
  it("accepts the next step long before the carousel has settled", () => {
    vi.useFakeTimers();
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, PAST_THRESHOLD);
    elapse(WHEEL_STEP_COOLDOWN_MS);
    wheel(stage, PAST_THRESHOLD);

    // Note what is NOT here: no `settle`. The fake carousel never emits one,
    // and the hook must not be waiting for it.
    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(2);
  });

  it("keeps up with a wheel spun steadily", () => {
    vi.useFakeTimers();
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    for (let notch = 0; notch < 4; notch += 1) {
      wheel(stage, PAST_THRESHOLD);
      elapse(WHEEL_STEP_COOLDOWN_MS);
    }

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(4);
  });

  it("claims the wheel while it still has a slide to move to", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    expect(wheel(stage, PAST_THRESHOLD).defaultPrevented).toBe(true);
  });

  // The gallery is one section of a page. Dead-ending the wheel on the last
  // photo would strand a reader who is trying to get to the size selector.
  it("releases the wheel to the page at the end of the carousel", () => {
    const carousel = fakeCarousel();
    carousel.spies.canScrollNext.mockReturnValue(false);
    const stage = mount(carousel.api);

    const event = wheel(stage, PAST_THRESHOLD);

    expect(event.defaultPrevented).toBe(false);
    expect(carousel.spies.scrollNext).not.toHaveBeenCalled();
  });

  it("releases the wheel to the page at the start of the carousel", () => {
    const carousel = fakeCarousel();
    carousel.spies.canScrollPrev.mockReturnValue(false);
    const stage = mount(carousel.api);

    expect(wheel(stage, -PAST_THRESHOLD).defaultPrevented).toBe(false);
  });

  // Firefox reports lines, not pixels. Unnormalised, `deltaY: 3` never
  // reaches a pixel threshold and the wheel appears dead.
  it("normalises a line-mode wheel into pixels", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, 3, 1);

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("stays out of the way of a horizontal wheel", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    const event = wheel(stage, 0);

    expect(event.defaultPrevented).toBe(false);
    expect(carousel.spies.scrollNext).not.toHaveBeenCalled();
  });

  it("does nothing at all while disabled", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api, false);

    const event = wheel(stage, PAST_THRESHOLD);

    expect(event.defaultPrevented).toBe(false);
    expect(carousel.spies.scrollNext).not.toHaveBeenCalled();
  });

  it("stops listening to the element when it unmounts", () => {
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, PAST_THRESHOLD);
    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);

    // `cleanup` unmounts, but the node itself survives in this scope — so a
    // handler still bound to it would happily fire.
    cleanup();
    wheel(stage, PAST_THRESHOLD);

    expect(carousel.spies.scrollNext).toHaveBeenCalledTimes(1);
  });

  // A pending cooldown outlives the component unless it is cancelled, and
  // firing into an unmounted hook is how a stray timer becomes a leak.
  it("cancels a pending cooldown on unmount", () => {
    vi.useFakeTimers();
    const carousel = fakeCarousel();
    const stage = mount(carousel.api);

    wheel(stage, PAST_THRESHOLD);
    cleanup();

    expect(() => elapse(WHEEL_STEP_COOLDOWN_MS * 4)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
