import { BackgroundVideo } from './background-video';

/** Landing artboard scrim: 70% black */
export const LANDING_SCRIM = '#00000070';

type PageScrimProps = {
  /**
   * Darkening scrim colour, as a CSS colour string. Differs per page in the
   * pen.dev artboards — landing uses 70% black (`#00000070`, the default),
   * the PDP uses 70% black (`#00000070`). Callers on the PDP must pass the
   * PDP value explicitly.
   */
  scrim?: string;
};

/**
 * Full-bleed, site-wide video plate. Still a sync server component: the
 * positioning and the scrim are plain markup, and only the `<video>` itself
 * crosses into `BackgroundVideo`'s client boundary — it has to, because when
 * the video may start fetching is a decision no server can make. See that
 * component for why the wait exists.
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
 * The poster is frame 0 of the video itself, not a hand-picked "nice" frame.
 * Any other frame would paint, then jump the moment decoding catches up —
 * and jump again on every loop, since the loop also restarts at frame 0.
 */
export function BackgroundPlate() {
  return (
    <>
      <PageScrim />
      <div className='fixed inset-0 -z-10' aria-hidden='true'>
        <BackgroundVideo />
      </div>
    </>
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
      aria-hidden='true'
      className='fixed inset-0 -z-9'
      style={{ backgroundColor: scrim }}
    />
  );
}
