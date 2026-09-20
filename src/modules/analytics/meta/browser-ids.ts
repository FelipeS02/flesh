/**
 * The cookie this app writes itself, holding Meta's `_fbc` value.
 *
 * Named apart from Meta's own `_fbp`, which the pixel writes and this code only
 * ever reads: an ad-blocked visit has no `_fbp` at all, and the whole point of
 * capturing the click id server-side is that it survives exactly that case.
 */
export const CLICK_ID_COOKIE_NAME = "flesh_fbc";

/** Meta attributes a click for 90 days, so a shorter cookie would throw away attribution the platform would still have honoured. */
export const CLICK_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** The pixel's own cookie. Read, never written here. */
export const PIXEL_COOKIE_NAME = "_fbp";

/**
 * Base64url, which is what Meta mints. Anything else is refused rather than
 * escaped: the value is assembled into a cookie and later into a JSON payload,
 * and a click id is never worth the risk of getting either quoting right.
 */
const CLICK_ID_PATTERN = /^[A-Za-z0-9_-]{1,512}$/;

/**
 * Meta defines this by counting labels — "com" is 0, "example.com" is 1,
 * "www.example.com" is 2 — and is naive about multi-part suffixes, so a
 * `.com.ar` host lands on 2. Reproducing their arithmetic matters more than
 * being right about registrable domains, because the number only has meaning
 * to them.
 */
export function subdomainIndexFor(host: string): number {
  if (!host) return 0;
  return Math.max(0, host.split(".").length - 1);
}

/**
 * Builds Meta's `_fbc` value, or `null` when the click id is unusable.
 *
 * `null` is not a failure to report: most visits carry no `fbclid` at all, and
 * a malformed one is indistinguishable from none as far as attribution goes.
 */
export function formatClickId(
  fbclid: string,
  nowMs: number,
  subdomainIndex: number,
): string | null {
  const clickId = fbclid.trim();
  if (!CLICK_ID_PATTERN.test(clickId)) return null;

  return `fb.${subdomainIndex}.${nowMs}.${clickId}`;
}
