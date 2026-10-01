import { describe, expect, it } from "vitest";
import {
  BLUR_ONSET,
  MAX_BLUR_PX,
  nativeScrollPosition,
  nativeSlideBlurs,
} from "../slide-blur";

describe("nativeScrollPosition", () => {
  // Slide tops, relative to the first. Slides need not be the same height:
  // each photo's height follows its own aspect ratio.
  const UNIFORM = [0, 722, 1444, 2166];
  const UNEVEN = [0, 400, 1000, 1500];

  it("turns scrollTop into a fractional slide index", () => {
    expect(nativeScrollPosition(0, UNIFORM)).toBe(0);
    expect(nativeScrollPosition(361, UNIFORM)).toBeCloseTo(0.5);
    expect(nativeScrollPosition(1444, UNIFORM)).toBe(2);
  });

  it("interpolates within the slide the scroller is over, whatever its height", () => {
    expect(nativeScrollPosition(200, UNEVEN)).toBeCloseTo(0.5);
    expect(nativeScrollPosition(700, UNEVEN)).toBeCloseTo(1.5);
    expect(nativeScrollPosition(1000, UNEVEN)).toBe(2);
    expect(nativeScrollPosition(1250, UNEVEN)).toBeCloseTo(2.5);
  });

  // Browsers park a snapped scroller on a fractional scrollTop, and a parked
  // photo must read as exactly zero blur, not a sliver of a slide away.
  it("rounds a position within half a pixel of a slide top onto that slide", () => {
    expect(nativeScrollPosition(1443.6, UNIFORM)).toBe(2);
    expect(nativeScrollPosition(1444.4, UNIFORM)).toBe(2);
    expect(nativeScrollPosition(1443.4, UNIFORM)).not.toBe(2);
    expect(nativeScrollPosition(999.7, UNEVEN)).toBe(2);
  });

  it("holds at the ends instead of running past them", () => {
    expect(nativeScrollPosition(-30, UNEVEN)).toBe(0);
    expect(nativeScrollPosition(1500, UNEVEN)).toBe(3);
    expect(nativeScrollPosition(9000, UNEVEN)).toBe(3);
  });

  it("reports the start for an unmeasured scroller", () => {
    expect(nativeScrollPosition(120, [])).toBe(0);
    expect(nativeScrollPosition(120, [0])).toBe(0);
    expect(nativeScrollPosition(Number.NaN, UNIFORM)).toBe(0);
    expect(nativeScrollPosition(120, [0, Number.NaN, 20])).toBe(0);
  });

  // A zero-height slide has the same top as the next one; dividing by that
  // gap would be a NaN position and an invalid filter string.
  it("is not thrown by two slides sharing a top", () => {
    expect(Number.isFinite(nativeScrollPosition(250, [0, 0, 500]))).toBe(true);
  });
});

describe("nativeSlideBlurs", () => {
  it("leaves the parked slide exactly sharp and blurs the rest fully", () => {
    expect(nativeSlideBlurs(2, 5)).toEqual([
      MAX_BLUR_PX,
      MAX_BLUR_PX,
      0,
      MAX_BLUR_PX,
      MAX_BLUR_PX,
    ]);
  });

  it("splits the blur between the two slides a scroll is between", () => {
    const values = nativeSlideBlurs(0.5, 3);

    expect(values[0]).toBeCloseTo(values[1]!);
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(MAX_BLUR_PX / 2);
    expect(values[2]).toBe(MAX_BLUR_PX);
  });

  // A tall photo is still mostly in view a good way into the scroll; blurring
  // it from the first pixel softened a photo the shopper was looking at.
  it("keeps a slide sharp until the scroll is well past it", () => {
    expect(nativeSlideBlurs(BLUR_ONSET, 3)[0]).toBe(0);
    expect(nativeSlideBlurs(BLUR_ONSET / 2, 3)[0]).toBe(0);
    expect(nativeSlideBlurs(BLUR_ONSET + 0.1, 3)[0]).toBeGreaterThan(0);
    expect(nativeSlideBlurs(1, 3)[0]).toBe(MAX_BLUR_PX);
  });

  it("blurs nothing for a single slide and survives an empty gallery", () => {
    expect(nativeSlideBlurs(0, 1)).toEqual([0]);
    expect(nativeSlideBlurs(0, 0)).toEqual([]);
  });

  it("never produces a negative or non-finite radius", () => {
    expect(nativeSlideBlurs(Number.NaN, 3)).toEqual(nativeSlideBlurs(0, 3));

    for (const value of nativeSlideBlurs(-2, 3).concat(nativeSlideBlurs(9, 3))) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(MAX_BLUR_PX);
    }
  });
});
