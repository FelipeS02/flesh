/** Landing artboard scrim: 75% black (`#000000BF`). */
export const LANDING_SCRIM = "#000000BF";

type PageScrimProps = {
  /**
   * Darkening scrim colour, as a CSS colour string. Differs per page in the
   * pen.dev artboards — landing uses 75% black (`#000000BF`, the default),
   * the PDP uses 70% black (`#000000B3`). Callers on the PDP must pass the
   * PDP value explicitly.
   */
  scrim?: string;
};

/**
 * Full-bleed, site-wide video plate. Sync server component — `autoPlay`/
 * `muted`/`loop`/`playsInline` are declarative HTML attributes, so no
 * `'use client'` boundary is needed.
 *
 * Mounted ONCE, in the root layout, and that placement is the whole point.
 * A layout survives a client-side navigation; a page does not. Rendered from
 * `page.tsx` this `<video>` was torn down and recreated on every route
 * change, which restarts playback from the first frame and re-fetches the
 * asset — the background visibly "blinked" on each link. From the layout the
 * same element stays mounted while `children` swaps underneath it, so the
 * loop just keeps running.
 *
 * Positioning: `fixed inset-0` with a negative `z-index`. The plate is pinned
 * to the VIEWPORT and the page scrolls over it, which is the only way one
 * video can back a document of any height — an absolute plate has to stretch
 * to the full content height, and a stretched `object-cover` video re-crops
 * itself as the page grows, so the same frame is composed differently on a
 * long PDP than on a short landing.
 *
 * `fixed` takes its containing block from the viewport, so it no longer needs
 * a `relative` page wrapper to size against.
 *
 * No poster image exists in this project; the artboard frame's own
 * `$background` (pure black) shows through before the video paints.
 */
export function BackgroundPlate() {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <video
        className="h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        tabIndex={-1}
      >
        <source src="/background.webm" type="video/webm" />
      </video>
    </div>
  );
}

/**
 * The darkening layer between the shared video plate and the page's content.
 *
 * Split out of `BackgroundPlate` because the two halves now live at different
 * levels: the video belongs to the layout (see above), while the scrim is a
 * per-page value the artboards deliberately vary. Rendering it from the page
 * is what keeps that difference expressible without handing the layout a prop
 * it would have to learn the route to choose.
 *
 * Both layers sit at the same negative `z-index`, so paint order is DOM
 * order: the layout's video comes first, this comes later and therefore over
 * it, and every positioned-auto element on the page paints over both.
 */
export function PageScrim({ scrim = LANDING_SCRIM }: PageScrimProps) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10"
      style={{ backgroundColor: scrim }}
    />
  );
}
