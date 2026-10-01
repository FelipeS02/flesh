/**
 * Whether the native desktop scroller snaps each photo into place
 * (`snap-y snap-mandatory`). A hand-toggled switch for testing the feel: free
 * scrolling shows the per-slide blur sweeping continuously, while snapping
 * parks every photo exactly on the stage. Slides snap by their START, which
 * sits just below the header (`scroll-padding-top`), so a parked photo is the
 * one under the header and the next one peeks below it.
 */
export const DESKTOP_SCROLL_SNAP = true;

/**
 * Where the gallery's edge fade starts when it is fully on, as a
 * percentage of the stage height: 96 fades the outer 4% (~29px of a 722px
 * stage). The engine holds the PIXEL depth, not the percentage, as the stage
 * grows with the window. A hand-tuned knob.
 *
 * Shallow on purpose: this fade is on while the shopper is looking at the
 * photo, and at 88 it ate the lower 12% of the garment. Lower numbers fade
 * deeper, 100 turns it off.
 */
export const DESKTOP_EDGE_FADE_STOP = 96;

/**
 * Whether the native desktop scroller runs UP BEHIND the sticky header, so a
 * photo scrolling up passes under the promo marquee and logotype instead of
 * being cut at the stage's top edge — the way the PDP's right-hand panel
 * already scrolls under it. The header's frosted backdrop follows the
 * gallery's own scroll while this is on.
 *
 * `false` is the original geometry: the scroller ends exactly at the stage.
 */
export const DESKTOP_GALLERY_UNDER_HEADER = true;

/**
 * How much of the visible stage the NEXT slide is guaranteed, as a fraction:
 * 0.2 keeps at least the bottom fifth for the next photo (blurred), an
 * invitation to scroll.
 *
 * Slides take their height from their own photo now, so this is no longer
 * "one slide's height". It is the CAP: a slide is at most
 * `visible * (1 - peek)` tall, so even a very tall photo leaves that strip.
 * A normal, shorter photo leaves more of the next one showing. It is also the
 * whole height of a slide whose photo could not be measured.
 *
 * 0 lets a slide fill the whole stage. Kept below 1 by the component, because
 * a slide has to keep some height of its own.
 */
export const DESKTOP_NEXT_SLIDE_PEEK = 0.2;
