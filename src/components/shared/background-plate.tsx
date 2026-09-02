/** Landing artboard scrim: 75% black (`#000000BF`). */
const LANDING_SCRIM = "#000000BF";

type BackgroundPlateProps = {
  /**
   * Darkening scrim colour, as a CSS colour string. Differs per page in the
   * pen.dev artboards — landing uses 75% black (`#000000BF`, the default),
   * the PDP uses 70% black (`#000000B3`). Callers on the PDP must pass the
   * PDP value explicitly.
   */
  scrim?: string;
};

/**
 * Full-bleed, site-wide page background: a looping muted video plate under a
 * darkening scrim. Sync server component — `autoPlay`/`muted`/`loop`/
 * `playsInline` are declarative HTML attributes, so no `'use client'`
 * boundary is needed.
 *
 * Verified against both the landing AND PDP pen.dev artboards: the same
 * two-layer plate appears on both, only the scrim strength differs (see
 * `scrim`). This is therefore a shared page background, not a landing-only
 * hero.
 *
 * Positioning: `absolute inset-0` with a negative `z-index`, meant to live
 * inside a `relative` page wrapper spanning the full page content height —
 * on the PDP the plate is 1708px tall (the whole document), not the
 * viewport. Deliberately NOT `fixed` and NOT `h-screen`. The page wrapper
 * itself is out of scope here (wired in PR6b for the landing, PR8a for the
 * PDP).
 *
 * No poster image exists in this project; the artboard frame's own
 * `$background` (pure black) shows through before the video paints.
 */
export function BackgroundPlate({ scrim = LANDING_SCRIM }: BackgroundPlateProps) {
  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
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
      <div className="absolute inset-0" style={{ backgroundColor: scrim }} />
    </div>
  );
}
