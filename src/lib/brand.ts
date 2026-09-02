/**
 * The brand as the UI already says it — `header.tsx` labels the home link
 * "FLESH — inicio" and the wordmark is the FLESH logotype.
 *
 * It lives here because three unrelated surfaces need the same string: the
 * root title template, the OpenGraph `siteName` on every page, and the
 * JSON-LD `brand`. Two of those are crawler-facing, so a drift between them
 * is a drift a search engine sees.
 */
export const BRAND = "FLESH";

/** The storefront's audience, for OpenGraph's locale field. */
export const BRAND_LOCALE = "es_AR";
