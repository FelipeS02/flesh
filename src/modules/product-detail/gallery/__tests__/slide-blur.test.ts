import { describe, expect, it } from "vitest";
import {
  MASK_STOP_AT_REST,
  MAX_BLUR_PX,
  edgeMaskStops,
  nativeScrollPosition,
  nativeSlideBlurs,
} from "../slide-blur";

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
  // The full-fade stop is the caller's: the maths has no opinion on depth.
  const FULL = 88;

  it("has no top fade on the first slide, but fades the bottom edge", () => {
    expect(edgeMaskStops(0, 5, FULL)).toEqual({ top: MASK_STOP_AT_REST, bottom: FULL });
  });

  it("has no bottom fade on the last slide, but fades the top edge", () => {
    expect(edgeMaskStops(4, 5, FULL)).toEqual({ top: FULL, bottom: MASK_STOP_AT_REST });
  });

  it("fades both edges fully in the middle of a long gallery", () => {
    expect(edgeMaskStops(2, 5, FULL)).toEqual({ top: FULL, bottom: FULL });
  });

  it("grows the top fade linearly over the first slide's travel", () => {
    expect(edgeMaskStops(0.5, 5, FULL).top).toBe(94);
    expect(edgeMaskStops(1, 5, FULL).top).toBe(FULL);
  });

  it("shrinks the bottom fade over the last slide's travel", () => {
    expect(edgeMaskStops(3.5, 5, FULL).bottom).toBe(94);
    expect(edgeMaskStops(4, 5, FULL).bottom).toBe(MASK_STOP_AT_REST);
  });

  it("fades only the edge with content beyond it in a two-slide gallery", () => {
    expect(edgeMaskStops(0, 2, FULL)).toEqual({ top: MASK_STOP_AT_REST, bottom: FULL });
    expect(edgeMaskStops(1, 2, FULL)).toEqual({ top: FULL, bottom: MASK_STOP_AT_REST });
    expect(edgeMaskStops(0.5, 2, FULL)).toEqual({ top: 94, bottom: 94 });
  });

  it("leaves a single slide and an empty gallery unmasked", () => {
    const none = { top: MASK_STOP_AT_REST, bottom: MASK_STOP_AT_REST };

    expect(edgeMaskStops(0, 1, FULL)).toEqual(none);
    expect(edgeMaskStops(0, 0, FULL)).toEqual(none);
  });

  it("fades to a caller-chosen depth", () => {
    expect(edgeMaskStops(2, 5, 96)).toEqual({ top: 96, bottom: 96 });
    expect(edgeMaskStops(0.5, 5, 96).top).toBe(98);
    expect(edgeMaskStops(0, 5, 96).top).toBe(MASK_STOP_AT_REST);
  });

  it("survives overshoot and unmeasured positions", () => {
    expect(edgeMaskStops(-0.4, 5, FULL)).toEqual(edgeMaskStops(0, 5, FULL));
    expect(edgeMaskStops(6, 5, FULL)).toEqual(edgeMaskStops(4, 5, FULL));
    expect(edgeMaskStops(Number.NaN, 5, FULL)).toEqual(edgeMaskStops(0, 5, FULL));
    expect(edgeMaskStops(Number.POSITIVE_INFINITY, 5, FULL)).toEqual(edgeMaskStops(0, 5, FULL));
  });
});
