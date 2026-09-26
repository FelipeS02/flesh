'use client';

import { useEffect } from 'react';

/**
 * Publishes the two heights the mobile gallery has to give back.
 *
 * The stage is meant to be exactly one screenful minus the chrome above and
 * below it: the sticky header band, and the fixed purchase widget. Neither
 * height is knowable from CSS — the band's wordmark is an SVG sized by its
 * own aspect ratio, and the widget's is its content — so writing them as
 * constants would mean two numbers that silently stop matching the components
 * they describe.
 *
 * Measured on mount and on RESIZE ONLY, never on scroll. The band shrinks as
 * you scroll, because the promo marquee collapses into it, and a stage that
 * re-measured mid-scroll would grow under your finger — the one thing worse
 * than being 30px off is moving while you read. The cost of that choice is an
 * edge case: a reload restored mid-scroll measures a band that is already
 * collapsed and leaves the stage short by the marquee's height until the next
 * resize. Visible only on that reload, and only until the viewport changes.
 *
 * "Resize only" is not enough on its own: mobile Safari and every iOS browser
 * report the toolbar collapsing on scroll as a resize, and by then the band is
 * already collapsed. Re-measuring there made the stage a marquee taller, so
 * back at the top it slid its thumbnails under the widget. Only a WIDTH change
 * can reflow the band or the widget, so a height-only resize is ignored.
 */
export function StageMetrics() {
  useEffect(() => {
    const band = document.querySelector('[data-header-band]');
    const widget = document.querySelector('[data-purchase-widget]');

    if (!band || !widget) return;

    const root = document.documentElement;

    const sync = () => {
      root.style.setProperty(
        '--pdp-band-height',
        `${band.getBoundingClientRect().height}px`,
      );
      root.style.setProperty(
        '--pdp-widget-height',
        `${widget.getBoundingClientRect().height}px`,
      );
    };

    let width = window.innerWidth;

    const onResize = () => {
      if (window.innerWidth === width) return;

      width = window.innerWidth;
      sync();
    };

    sync();
    window.addEventListener('resize', onResize, { passive: true });

    return () => window.removeEventListener('resize', onResize);
  }, []);

  return null;
}
