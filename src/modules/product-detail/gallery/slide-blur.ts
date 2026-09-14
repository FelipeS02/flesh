/**
 * How out of focus a slide sitting fully off-stage is. Deliberately modest:
 * `filter: blur()` on a full-bleed photo is repainted every animation frame
 * while the carousel moves, and the cost climbs with the radius.
 */
export const MAX_BLUR_PX = 7;

export type SlideVisualState = {
  scale: number;
  opacity: number;
  blur: number;
  filter: string;
  pointerEvents: "auto" | "none";
};

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

/**
 * The complete desktop style contract while Embla is moving. It keeps the
 * calculation pure so the animation loop can paint nodes directly instead of
 * making React reconcile the whole gallery for every scroll frame.
 */
export function slideVisualStates(
  progress: number,
  slideCount: number,
): SlideVisualState[] {
  if (slideCount < 1) return [];

  const clamped =
    Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;

  return visualStatesFromPosition(clamped * Math.max(slideCount - 1, 0), slideCount);
}

/** The exact visual state after Embla has settled on one integer snap. */
export function restingSlideVisualStates(
  selectedIndex: number,
  slideCount: number,
): SlideVisualState[] {
  if (slideCount < 1) return [];

  return visualStatesFromPosition(
    Math.min(Math.max(selectedIndex, 0), slideCount - 1),
    slideCount,
  );
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

function visualStatesFromPosition(
  position: number,
  slideCount: number,
): SlideVisualState[] {
  return Array.from({ length: slideCount }, (_, index) => {
    const distance = Math.abs(index - position);
    const nearby = Math.min(distance, 1);
    const opacity = distance >= 2 ? 0 : 1 - nearby * 0.6;
    const scale = 1 - nearby * 0.15;
    const blur = nearby * MAX_BLUR_PX;

    return {
      scale,
      opacity,
      blur,
      filter: blur === 0 ? "" : `blur(${blur}px)`,
      pointerEvents: distance === 0 ? "auto" : "none",
    };
  });
}

/**
 * Where the stage's edge fade starts when nothing is moving: at the very
 * edge, which is to say nowhere. A mask is plain CSS and cannot know whether
 * embla is mid-transition, so a hardcoded `mask-y-from-95%` softened the
 * resting photo too — the one frame the page exists to show sharp.
 */
export const MASK_STOP_AT_REST = 100;

/** The deepest fade, reached exactly halfway between two snaps. */
export const MASK_STOP_MID_TRANSITION = 88;

/**
 * Where the stage's vertical edge fade should start, as a percentage, for a
 * given embla scroll position.
 *
 * Continuous by design rather than a moving/resting toggle. Switching the
 * mask on at `scroll` and off at `settle` steps the fade in and out in one
 * frame at both ends of every transition, which reads as a flicker —
 * precisely the hard edge this is here to remove. Derived from the distance
 * to the nearest snap the value grows from and returns to zero on its own,
 * and lands on exactly `MASK_STOP_AT_REST` at a snap by construction.
 */
export function maskStop(progress: number, slideCount: number): number {
  // With one slide there is no transition to soften, and the position maths
  // below would divide the progress by zero gaps.
  if (slideCount < 2) return MASK_STOP_AT_REST;

  // Same guards as the blur: embla rubber-bands past 0..1 at the ends and
  // reports `NaN` before it has measured anything.
  const clamped =
    Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const position = clamped * (slideCount - 1);

  // Distance to the nearest snap is 0..0.5, so doubling it spans the fade
  // across a whole transition: 0 parked, 1 at the midpoint.
  const travelled = Math.abs(position - Math.round(position)) * 2;

  return MASK_STOP_AT_REST - travelled * (MASK_STOP_AT_REST - MASK_STOP_MID_TRANSITION);
}
