/**
 * URL construction for Tiendanube's media CDN.
 *
 * The CDN is a plain object store with PRE-GENERATED derivatives, not an
 * image service. It resizes nothing on demand and negotiates no format —
 * requesting the `.png` URL with `Accept: image/webp` still returns PNG. A
 * variant is addressed by filename, so asking for one is a string rewrite,
 * and asking wrong returns `AccessDenied` and a blank image rather than a
 * fallback. That is why this lives in one module instead of at each call
 * site.
 *
 * Probed against dcdn-us.mitiendanube.com:
 *
 *   <base>-<w>-0.<ext>      ONLY w in MEDIA_WIDTHS; every other width 403s
 *   <base>-1024-1024.<ext>  what the API's `src` carries; despite the square
 *                           suffix the real pixels are 1024x788
 *   <base>.<ext>            the untouched original (2395x1844 on the drop we
 *                           measured), original extension ONLY
 *
 * Two asymmetries drive every decision below. `.webp` exists for the sized
 * derivatives but NOT for the original — swapping the extension there 403s.
 * And nothing between 640 and the original exists at all, so a slot needing
 * 700 source pixels has no derivative to ask for and must fall back to a
 * 1.4 MB unconverted PNG.
 */

/**
 * The only widths the CDN has generated. Snapping to this list is not a
 * nicety: an unlisted width is a 403, so a call site that computed 700 from
 * a layout gets nothing rather than a close-enough image.
 */
export const MEDIA_WIDTHS = [50, 100, 240, 320, 480, 640] as const;

/** The widest derivative, past which only the original has enough pixels. */
const WIDEST_VARIANT = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];

/**
 * Matches the `-<width>-<height>` the CDN appends before the extension.
 * Anchored at the end so a product handle that happens to contain digits
 * and dashes cannot be mistaken for the size suffix.
 */
const SIZE_SUFFIX = /-\d+-\d+(\.[a-z0-9]+)$/i;

/**
 * What a call site hands `next/image`: the URL, and whether Next should
 * optimize it or pass it through.
 */
export type MediaSource = {
  src: string;
  /** Mirrors `next/image`'s prop of the same name, to spread directly. */
  unoptimized: boolean;
};

type MediaParts = { base: string; extension: string };

/**
 * Returns `null` for anything that is not a suffixed CDN URL — a seeded
 * fixture, a future CDN migration, a merchant-pasted absolute URL. Every
 * function here degrades to the original string on `null` rather than
 * building a URL it cannot verify.
 */
function parseMedia(src: string): MediaParts | null {
  const match = SIZE_SUFFIX.exec(src);
  if (!match) return null;

  return { base: src.slice(0, match.index), extension: match[1] };
}

/** The smallest generated width that still covers `width`. */
function snapWidth(width: number): number | null {
  return MEDIA_WIDTHS.find((candidate) => candidate >= width) ?? null;
}

/**
 * A pre-generated derivative at least `width` pixels wide, as WebP.
 *
 * Snaps UP, never down: a browser downscaling a slightly larger image is
 * invisible, while upscaling a smaller one is the blur this whole
 * investigation started from. Returns `null` when no derivative is wide
 * enough — the caller then owes a decision, which is `mediaSource`'s job.
 */
export function mediaVariant(src: string, width: number): string | null {
  const parts = parseMedia(src);
  if (!parts) return null;

  const snapped = snapWidth(width);
  if (snapped === null) return null;

  // WebP is a straight extension swap on the derivatives, and the saving is
  // not marginal: 263 KB of PNG against 21 KB of WebP at 1024px. The source
  // images are PNG, which is lossless compression applied to photographs —
  // the worst possible container for them.
  return `${parts.base}-${snapped}-0.webp`;
}

/**
 * The unresized, unconverted original.
 *
 * Keeps the original extension deliberately: the `.webp` swap that works on
 * every derivative 403s here, because the original is the merchant's upload
 * rather than something the CDN produced.
 */
export function mediaOriginal(src: string): string {
  const parts = parseMedia(src);
  if (!parts) return src;

  return `${parts.base}${parts.extension}`;
}

/**
 * Resolve the image for a slot that renders `width` CSS pixels wide.
 *
 * This is the hybrid, and the split is forced by what the CDN actually has
 * rather than chosen. Below the widest derivative, the CDN has already done
 * the resize and the WebP conversion, so routing that through Next's
 * optimizer would re-encode an image that is already right — server CPU and
 * cache storage spent to arrive where we started. Above it, the only source
 * with enough pixels is the original: full-resolution, uncompressed, and
 * PNG. That one genuinely needs optimizing, and nobody but us will do it.
 *
 * `dpr` defaults to 2 because the derivative is chosen at build/render time,
 * before any device has been seen. Assuming 1 would ship a visibly soft
 * image to every retina screen; assuming 2 costs a downscale on the 1x
 * screens, which is free and invisible.
 */
export function mediaSource(
  src: string,
  { width, dpr = 2 }: { width: number; dpr?: number },
): MediaSource {
  const needed = Math.ceil(width * dpr);

  if (needed <= WIDEST_VARIANT) {
    const variant = mediaVariant(src, needed);
    // `unoptimized` is the point of this branch, not an afterthought: the
    // bytes are already WebP at the right size, so Next has nothing left to
    // contribute except cost.
    if (variant) return { src: variant, unoptimized: true };
  }

  return { src: mediaOriginal(src), unoptimized: false };
}
