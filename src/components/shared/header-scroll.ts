/**
 * How far, in pixels, a scroll has to travel for the header backdrop to be
 * fully in. One number shared by the two things that can drive it — the page
 * (`Header`) and the PDP gallery's own scroller — so they fade the same way.
 */
export const HEADER_SCROLL_RANGE = 160;

/**
 * Published on the document root by anything that scrolls up BEHIND the
 * header without scrolling the page. The band takes the larger of this and
 * its own `--header-scroll-progress` for its backdrop only, so it never has to
 * know a gallery exists.
 */
export const UNDER_HEADER_PROGRESS_PROPERTY = '--gallery-under-header-progress';
