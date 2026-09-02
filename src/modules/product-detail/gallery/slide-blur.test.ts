import { describe, expect, it } from "vitest";
import { MAX_BLUR_PX, slideBlurValues } from "./slide-blur";

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
