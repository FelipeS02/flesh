/**
 * Whether the native desktop scroller snaps each photo into place
 * (`snap-y snap-mandatory`). A hand-toggled switch for testing the feel: free
 * scrolling shows the per-slide blur sweeping continuously, while snapping
 * parks every photo exactly on the stage. Slides snap by their START, which
 * sits just below the header (`scroll-padding-top`), so a parked photo is the
 * one under the header and the next one peeks below it.
 *
 * Off as shipped: the gallery is a free scroll, and the flag stays for trying
 * the snapping feel again.
 */
export const DESKTOP_SCROLL_SNAP = false;

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
