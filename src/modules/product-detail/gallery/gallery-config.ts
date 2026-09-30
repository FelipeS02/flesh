/**
 * Which engine drives the gallery on desktop (`md+`).
 *
 * - `native-scroll`: an ordinary vertical scroll inside the stage. The wheel
 *   and trackpad scroll it freely, and blur/edge-fade are painted from
 *   `scrollTop`.
 * - `embla`: the original controlled carousel — one slide per wheel gesture,
 *   with scale/opacity/blur painted from Embla's `scrollProgress()`. Kept in
 *   full (`use-embla-desktop.ts`) rather than deleted, so the two can be
 *   compared by feel without digging through history.
 *
 * Mobile is unaffected either way: it is always native horizontal scroll-snap.
 *
 * This is a module constant on purpose, not state or a prop. Both engine
 * hooks are called on every render and gate themselves on it, so flipping it
 * is an edit-and-reload, and the hook call order can never change at runtime.
 */
export type DesktopGalleryEngine = "native-scroll" | "embla";

export const DESKTOP_GALLERY_ENGINE: DesktopGalleryEngine = "native-scroll";

/**
 * Whether the native desktop scroller snaps each photo into place
 * (`snap-y snap-mandatory`). A hand-toggled switch for testing the feel: free
 * scrolling shows the per-slide blur sweeping continuously, while snapping
 * parks every photo exactly on the stage. Slides are one stage tall, so their
 * centre and their start coincide and `snap-center` is correct for both.
 *
 * Only read by the `native-scroll` engine; Embla does its own snapping.
 */
export const DESKTOP_SCROLL_SNAP = false;

/**
 * Where the native engine's edge fade starts when it is fully on, as a
 * percentage of the stage height: 96 fades the outer 4% (~29px of the 722px
 * stage). A hand-tuned knob like the two above.
 *
 * Shallower than Embla's 88 on purpose. That fade only existed for the
 * midpoint of a transition; this one is on while the shopper is looking at the
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
 * Only read by the `native-scroll` engine. `false` is the original geometry:
 * the scroller ends exactly at the stage.
 */
export const DESKTOP_GALLERY_UNDER_HEADER = true;
