import { BackgroundVideo } from './background-video';

/**
 * Artboard scrim: black at `0x70` alpha, which is 112/255 — about 44%, NOT the
 * 70% the hex reads as. The two digits are hexadecimal like every other pair
 * in the colour; only the `70` invites being read as a percentage.
 */
export const LANDING_SCRIM = '#00000070';

type PageScrimProps = {
  /**
   * Darkening scrim colour, as a CSS colour string.
   *
   * The artboards were read as varying this per page; they do not — landing
   * and PDP are both `#00000070`. The prop stays because a route may yet need
   * its own value, but nothing overrides the default today.
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
 * `BackgroundPlate` renders one, so every route gets a baseline without any
 * page having to remember to. A page may still render its own, and that
 * STACKS rather than replaces: two `#00000070` layers composite to ~69% black
 * instead of ~44%. `/devoluciones` does exactly that on purpose — it is a long
 * column of prose read over a moving video, and the baseline is not enough
 * ground for it.
 *
 * So a second one is a deliberate choice per route, never an accident. If a
 * route ever needs a different colour rather than more of the same, that needs
 * an opt-out on the plate, which does not exist today.
 *
 * Both layers sit at the same negative `z-index`, so paint order is DOM
 * order: the layout's video comes first, this comes later and therefore over
 * it, and every positioned-auto element on the page paints over both.
 */
export function PageScrim({ scrim = LANDING_SCRIM }: PageScrimProps) {
  return (
    <div
      // Queryable on purpose, so a test can COUNT the layers a route ends up
      // with. The sibling selector this replaces could not see a scrim painted
      // BEFORE the video, so it reported zero either way and guarded nothing.
      data-page-scrim
      aria-hidden='true'
      className='fixed inset-0 -z-9'
      style={{ backgroundColor: scrim }}
    />
  );
}
