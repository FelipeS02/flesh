export type MetaConfig = { pixelId: string };

/**
 * All digits, because that is what makes the id safe to interpolate into the
 * inline bootstrap below. The width bound is deliberately loose: Meta has never
 * documented a fixed pixel-id length, so pinning today's 15-16 digits would
 * reject a valid id the day they widen it, and the injection guard does not
 * depend on the width at all.
 */
const PIXEL_ID_PATTERN = /^\d{8,20}$/;

type MetaEnvironment = { NEXT_PUBLIC_META_PIXEL_ID?: string };

/**
 * The default argument reads the LITERAL `process.env.NEXT_PUBLIC_*` member
 * expression, for the same reason `../config.ts` does — see the comment there.
 * Next only substitutes public env vars into the client bundle where it can see
 * that exact expression, so aliasing it behind a parameter default ships
 * `undefined` to the browser while the server-rendered tag keeps loading fine.
 *
 * Keep the parameter for injection, never widen it back to `process.env`.
 */
export function readMetaConfig(
  environment: MetaEnvironment = {
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  },
): MetaConfig | null {
  const pixelId = environment.NEXT_PUBLIC_META_PIXEL_ID?.trim();

  return pixelId && PIXEL_ID_PATTERN.test(pixelId) ? { pixelId } : null;
}

function assertPixelId(pixelId: string): void {
  if (!PIXEL_ID_PATTERN.test(pixelId)) {
    throw new Error("Invalid Meta pixel id.");
  }
}

export function metaPixelSource(): string {
  return "https://connect.facebook.net/en_US/fbevents.js";
}

/**
 * Reproduces Meta's official stub verbatim, minus its script-injection tail —
 * the script is loaded by `next/script` instead, exactly as the Google tag is.
 *
 * The stub shape is a contract with `fbevents.js`, not boilerplate to tidy: the
 * library adopts the existing `window.fbq` and drains `n.queue`, so a call made
 * before the script finishes loading is only kept if `queue`, `push`, `loaded`
 * and `version` are set up the way it expects. A "simpler" stub loses every
 * event fired during that window, silently.
 *
 * No `PageView` here on purpose. `PageViewTracker` emits one per pathname, the
 * same way the Google tag boots with `send_page_view:false`; letting the snippet
 * fire its own would double-count the first page of every visit.
 */
export function metaPixelBootstrap(pixelId: string): string {
  assertPixelId(pixelId);

  return [
    "(function(f){",
    "if(f.fbq)return;",
    "var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
    "if(!f._fbq)f._fbq=n;",
    "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]",
    "})(window);",
    `fbq('init','${pixelId}')`,
  ].join("");
}
