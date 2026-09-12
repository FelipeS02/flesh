/**
 * How out of focus a slide sitting fully off-stage is. Deliberately modest:
 * `filter: blur()` on a full-bleed photo is repainted every animation frame
 * while the carousel moves, and the cost climbs with the radius.
 */
export const MAX_BLUR_PX = 10;

/**
 * The blur radius, in pixels, for every slide at a given scroll position.
 *
 * Expressed against embla's `scrollProgress()` rather than the selected
 * index so the effect is continuous: mid-drag the incoming slide is already
 * partly sharp instead of snapping clear the instant `select` fires. At rest
 * the progress lands exactly on a snap, so this same function also describes
 * the resting state — there is no second code path for "not moving".
 *
 * Assumes one slide per snap, which the gallery's `basis-full` items
 * guarantee.
 */
export function slideBlurValues(progress: number, slideCount: number): number[] {
  // A single slide is never off-stage, and dividing by `slideCount - 1`
  // below would ask what fraction of zero the progress is.
  if (slideCount < 2) return noBlur(slideCount);

  // Embla overshoots 0..1 while a drag rubber-bands past an end, and reports
  // `NaN` before it has measured anything (server render, jsdom, a container
  // that is still display:none). Both would produce a filter string the
  // browser discards, turning the effect off with no error anywhere.
  const clamped =
    Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;

  // Progress 0..1 spans every snap, so scaling by the gaps between them
  // turns it into a fractional slide index: 1.5 means halfway from the
  // second slide to the third.
  const position = clamped * (slideCount - 1);

  return blursFromPosition(position, slideCount);
}

/**
 * The blur radius for every slide while the carousel RESTS on `selectedIndex`.
 *
 * Same effect, addressed by snap index instead of by progress, and that is
 * the whole reason it exists. Deriving the resting state from
 * `scrollProgress()` puts a float division and a float multiplication
 * between the snap and the answer, so the slide you are parked on can come
 * back as 0.9999999999999998 of a slide away and keep a sliver of blur —
 * visible on mobile, where the compositor rasterises the filtered layer
 * once and softens the photo for as long as it stands. A snap index is an
 * integer, so this lands on exactly zero by construction.
 */
export function restingBlurValues(selectedIndex: number, slideCount: number): number[] {
  if (slideCount < 2) return noBlur(slideCount);

  return blursFromPosition(selectedIndex, slideCount);
}

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

    return distance * MAX_BLUR_PX;
  });
}
