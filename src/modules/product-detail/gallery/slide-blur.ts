/**
 * How out of focus a slide sitting fully off-stage is. Deliberately modest:
 * `filter: blur()` on a full-bleed photo is repainted every animation frame
 * while the gallery scrolls, and the cost climbs with the radius.
 */
export const MAX_BLUR_PX = 7;

/**
 * How far, in slides, the scroll has to move off a slide before it starts to
 * blur. Slides take their photo's height, so a tall one is still mostly in
 * view well into the scroll; a ramp starting at zero softened the photo the
 * shopper was still looking at.
 */
export const BLUR_ONSET = 0.3;

function noBlur(slideCount: number): number[] {
  return Array.from({ length: Math.max(slideCount, 0) }, () => 0);
}

/** `position` is a fractional slide index: 1.5 is halfway from slide 2 to 3. */
function blursFromPosition(position: number, slideCount: number): number[] {
  return Array.from({ length: slideCount }, (_, index) => {
    // Capped at one slide of distance: the second slide away is already
    // fully off-stage, and blurring it harder would only cost paint time
    // for something nobody can see.
    const distance = Math.min(Math.abs(index - position), 1);

    const ramp = Math.max(distance - BLUR_ONSET, 0) / (1 - BLUR_ONSET);

    return ramp * MAX_BLUR_PX;
  });
}

/**
 * How close, in pixels, a native scroller has to be to a slide's top before it
 * counts as sitting exactly on it.
 */
const NATIVE_REST_TOLERANCE_PX = 0.5;

/**
 * The fractional slide index a native vertical scroller is at, given where
 * each slide's top is: 1.5 is halfway from the second slide's top to the
 * third's.
 *
 * `slideTops` are measured from the first slide, so `scrollTop` 0 is the
 * first slide parked. They are an array, not one pitch, because slides take
 * their own photo's height and are no longer all the same: the position is
 * interpolated inside whichever slide the scroller is over.
 *
 * Snap-rounding is the concern `nativeSlideBlurs` depends on: a parked
 * scroller sits on a fractional `scrollTop` (subpixel layout, device-pixel
 * rounding), which would leave the parked photo a sliver of a slide away and
 * keep a trace of blur on the one photo that must be sharp. Within half a
 * pixel of a top the answer is that slide's integer.
 *
 * An unmeasured scroller (display:none, jsdom, fewer than two slides)
 * reports the start rather than `NaN`, which would make every filter string
 * invalid. The ends hold: past the last top the position stays on the last
 * slide.
 */
export function nativeScrollPosition(
  scrollTop: number,
  slideTops: readonly number[],
): number {
  if (!Number.isFinite(scrollTop) || slideTops.length < 2) return 0;
  if (slideTops.some((top) => !Number.isFinite(top))) return 0;

  const last = slideTops.length - 1;
  if (scrollTop <= slideTops[0]!) return 0;
  if (scrollTop >= slideTops[last]! - NATIVE_REST_TOLERANCE_PX) return last;

  for (let index = 0; index < last; index += 1) {
    const top = slideTops[index]!;
    const nextTop = slideTops[index + 1]!;

    if (scrollTop < top - NATIVE_REST_TOLERANCE_PX || scrollTop >= nextTop) continue;
    if (Math.abs(scrollTop - top) < NATIVE_REST_TOLERANCE_PX) return index;
    if (Math.abs(nextTop - scrollTop) < NATIVE_REST_TOLERANCE_PX) return index + 1;

    // Two slides sharing a top (a zero-height one) leave no span to
    // interpolate across.
    return nextTop > top ? index + (scrollTop - top) / (nextTop - top) : index;
  }

  return last;
}

/**
 * The blur radius for every slide, from the fractional position
 * `nativeScrollPosition` returns.
 *
 * Blur ONLY. The previous carousel also scaled and faded the off-stage slides,
 * and that is dropped on purpose: with free scrolling a scaled slide is
 * shorter than its slot, which opens a visible gap between two photos
 * mid-scroll, and opacity would show the page behind them.
 */
export function nativeSlideBlurs(position: number, slideCount: number): number[] {
  if (slideCount < 2) return noBlur(slideCount);

  return blursFromPosition(Number.isFinite(position) ? position : 0, slideCount);
}
