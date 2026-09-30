import { describe, expect, it } from "vitest";
import {
  MASK_STOP_AT_REST,
  MASK_STOP_MID_TRANSITION,
  MAX_BLUR_PX,
  edgeMaskStops,
  maskStop,
  nativeScrollPosition,
  nativeSlideBlurs,
  restingSlideVisualStates,
  slideBlurValues,
  slideVisualStates,
} from "../slide-blur";

describe("slideBlurValues", () => {
  it("blurs nothing when there is only one slide", () => {
    expect(slideBlurValues(0, 1)).toEqual([0]);
    expect(slideBlurValues(0, 0)).toEqual([]);
  });

  it("keeps the resting slide sharp and blurs every other one fully", () => {
    expect(slideBlurValues(0, 5)).toEqual([
      0,
      MAX_BLUR_PX,
      MAX_BLUR_PX,
      MAX_BLUR_PX,
      MAX_BLUR_PX,
    ]);
  });

  it("follows the resting slide as the progress moves to a later snap", () => {
    // Five slides span progress 0..1, so the middle snap sits at 0.5.
    expect(slideBlurValues(0.5, 5)).toEqual([
      MAX_BLUR_PX,
      MAX_BLUR_PX,
      0,
      MAX_BLUR_PX,
      MAX_BLUR_PX,
    ]);
  });

  // The whole point of the effect: mid-drag the incoming slide is already
  // half-sharp, rather than snapping from blurred to clear on `select`.
  it("splits the blur between two slides halfway through a drag", () => {
    const halfwayFromFirstToSecond = 0.125;

    const values = slideBlurValues(halfwayFromFirstToSecond, 5);

    expect(values[0]).toBeCloseTo(MAX_BLUR_PX / 2);
    expect(values[1]).toBeCloseTo(MAX_BLUR_PX / 2);
    expect(values.slice(2)).toEqual([MAX_BLUR_PX, MAX_BLUR_PX, MAX_BLUR_PX]);
  });

  it("never blurs a distant slide more than a neighbouring one", () => {
    for (const value of slideBlurValues(0, 5)) {
      expect(value).toBeLessThanOrEqual(MAX_BLUR_PX);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  // Embla reports progress outside 0..1 while a drag rubber-bands past an
  // end. Left unclamped that reads as a negative blur, which is invalid CSS.
  it("clamps progress that rubber-bands past either end", () => {
    expect(slideBlurValues(-0.4, 3)).toEqual(slideBlurValues(0, 3));
    expect(slideBlurValues(1.4, 3)).toEqual(slideBlurValues(1, 3));
  });

  // jsdom has no layout, so embla measures every snap at zero and reports
  // `NaN` progress. A `filter: blur(NaNpx)` is dropped by the browser and
  // would silently disable the effect rather than fail loudly.
  it("treats an unmeasurable progress as resting on the first slide", () => {
    expect(slideBlurValues(Number.NaN, 3)).toEqual(slideBlurValues(0, 3));
  });
});

describe("desktop slide visual states", () => {
  it("uses the exact active, adjacent, and far resting contracts", () => {
    expect(restingSlideVisualStates(2, 5)).toEqual([
      { scale: 0.85, opacity: 0, blur: MAX_BLUR_PX, filter: `blur(${MAX_BLUR_PX}px)`, pointerEvents: "none" },
      { scale: 0.85, opacity: 0.4, blur: MAX_BLUR_PX, filter: `blur(${MAX_BLUR_PX}px)`, pointerEvents: "none" },
      { scale: 1, opacity: 1, blur: 0, filter: "", pointerEvents: "auto" },
      { scale: 0.85, opacity: 0.4, blur: MAX_BLUR_PX, filter: `blur(${MAX_BLUR_PX}px)`, pointerEvents: "none" },
      { scale: 0.85, opacity: 0, blur: MAX_BLUR_PX, filter: `blur(${MAX_BLUR_PX}px)`, pointerEvents: "none" },
    ]);
  });

  it("interpolates the visual state while the selected slide is between snaps", () => {
    const values = slideVisualStates(0.125, 5);

    expect(values[0]).toMatchObject({ scale: 0.925, opacity: 0.7, blur: 3.5 });
    expect(values[1]).toMatchObject({ scale: 0.925, opacity: 0.7, blur: 3.5 });
    expect(values[2]).toMatchObject({ opacity: 0.4, blur: MAX_BLUR_PX });
  });

  it("omits a filter value for a sharp slide", () => {
    expect(restingSlideVisualStates(0, 2)[0]?.filter).toBe("");
    expect(restingSlideVisualStates(0, 2)[1]?.filter).toBe(
      `blur(${MAX_BLUR_PX}px)`,
    );
  });
});

describe("maskStop", () => {
  it("leaves the stage unmasked when there is nothing to transition between", () => {
    expect(maskStop(0, 1)).toBe(MASK_STOP_AT_REST);
    expect(maskStop(0, 0)).toBe(MASK_STOP_AT_REST);
  });

  it("leaves the stage unmasked while it rests on a snap", () => {
    expect(maskStop(0, 5)).toBe(MASK_STOP_AT_REST);
    expect(maskStop(0.5, 5)).toBe(MASK_STOP_AT_REST);
    expect(maskStop(1, 5)).toBe(MASK_STOP_AT_REST);
  });

  // The reason the value is continuous rather than a moving/resting toggle:
  // switching it on at `scroll` and off at `settle` pops at both ends.
  it("deepens the fade towards the midpoint between two snaps", () => {
    const quarterOfTheWay = 0.0625;
    const halfway = 0.125;

    expect(maskStop(quarterOfTheWay, 5)).toBe(94);
    expect(maskStop(halfway, 5)).toBe(MASK_STOP_MID_TRANSITION);
  });

  it("survives the out-of-range and unmeasured values embla reports", () => {
    expect(maskStop(-0.4, 5)).toBe(MASK_STOP_AT_REST);
    expect(maskStop(1.4, 5)).toBe(MASK_STOP_AT_REST);
    expect(maskStop(Number.NaN, 5)).toBe(MASK_STOP_AT_REST);
  });
});

describe("nativeScrollPosition", () => {
  it("turns scrollTop into a fractional slide index", () => {
    expect(nativeScrollPosition(0, 722)).toBe(0);
    expect(nativeScrollPosition(361, 722)).toBeCloseTo(0.5);
    expect(nativeScrollPosition(1444, 722)).toBe(2);
  });

  // Browsers park a snapped scroller on a fractional scrollTop, and a parked
  // photo must read as exactly zero blur, not a sliver of a slide away.
  it("rounds a position within half a pixel of a snap onto that snap", () => {
    expect(nativeScrollPosition(1443.6, 722)).toBe(2);
    expect(nativeScrollPosition(1444.4, 722)).toBe(2);
    expect(nativeScrollPosition(1443.4, 722)).not.toBe(2);
  });

  it("reports the start for an unmeasured scroller", () => {
    expect(nativeScrollPosition(120, 0)).toBe(0);
    expect(nativeScrollPosition(Number.NaN, 722)).toBe(0);
    expect(nativeScrollPosition(120, Number.NaN)).toBe(0);
    expect(nativeScrollPosition(120, -5)).toBe(0);
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

    expect(values[0]).toBeCloseTo(MAX_BLUR_PX / 2);
    expect(values[1]).toBeCloseTo(MAX_BLUR_PX / 2);
    expect(values[2]).toBe(MAX_BLUR_PX);
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

describe("edgeMaskStops", () => {
  const FULL = MASK_STOP_MID_TRANSITION;

  it("has no top fade on the first slide, but fades the bottom edge", () => {
    expect(edgeMaskStops(0, 5)).toEqual({ top: MASK_STOP_AT_REST, bottom: FULL });
  });

  it("has no bottom fade on the last slide, but fades the top edge", () => {
    expect(edgeMaskStops(4, 5)).toEqual({ top: FULL, bottom: MASK_STOP_AT_REST });
  });

  it("fades both edges fully in the middle of a long gallery", () => {
    expect(edgeMaskStops(2, 5)).toEqual({ top: FULL, bottom: FULL });
  });

  it("grows the top fade linearly over the first slide's travel", () => {
    expect(edgeMaskStops(0.5, 5).top).toBe(94);
    expect(edgeMaskStops(1, 5).top).toBe(FULL);
  });

  it("shrinks the bottom fade over the last slide's travel", () => {
    expect(edgeMaskStops(3.5, 5).bottom).toBe(94);
    expect(edgeMaskStops(4, 5).bottom).toBe(MASK_STOP_AT_REST);
  });

  it("fades only the edge with content beyond it in a two-slide gallery", () => {
    expect(edgeMaskStops(0, 2)).toEqual({ top: MASK_STOP_AT_REST, bottom: FULL });
    expect(edgeMaskStops(1, 2)).toEqual({ top: FULL, bottom: MASK_STOP_AT_REST });
    expect(edgeMaskStops(0.5, 2)).toEqual({ top: 94, bottom: 94 });
  });

  it("leaves a single slide and an empty gallery unmasked", () => {
    const none = { top: MASK_STOP_AT_REST, bottom: MASK_STOP_AT_REST };

    expect(edgeMaskStops(0, 1)).toEqual(none);
    expect(edgeMaskStops(0, 0)).toEqual(none);
  });

  it("survives overshoot and unmeasured positions", () => {
    expect(edgeMaskStops(-0.4, 5)).toEqual(edgeMaskStops(0, 5));
    expect(edgeMaskStops(6, 5)).toEqual(edgeMaskStops(4, 5));
    expect(edgeMaskStops(Number.NaN, 5)).toEqual(edgeMaskStops(0, 5));
    expect(edgeMaskStops(Number.POSITIVE_INFINITY, 5)).toEqual(edgeMaskStops(0, 5));
  });
});
