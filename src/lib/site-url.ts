/**
 * The absolute origin every crawler-facing URL resolves against.
 *
 * Deliberately NOT a `NEXT_PUBLIC_` variable: `metadataBase`, `generateMetadata`
 * and the JSON-LD block all run on the server, so shipping the value into the
 * browser bundle would buy nothing. Promote it if a client component ever needs
 * an absolute URL.
 *
 * The fallback chain is what makes the SEO work land BEFORE the domain is
 * bought — nothing here needs the final host to be decided:
 *
 * 1. `SITE_URL` — the real domain, once there is one.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — set by Vercel, hostname only, no scheme.
 * 3. `http://localhost:3000` — so a dev build still resolves absolute URLs
 *    instead of emitting relative ones a crawler cannot follow.
 */
const LOCAL_ORIGIN = "http://localhost:3000";

export function siteUrl(): URL {
  const configured = present(process.env.SITE_URL);
  if (configured) {
    return new URL(configured);
  }

  // Vercel exposes the host WITHOUT a scheme ("flesh.vercel.app"), which `URL`
  // would otherwise read as a relative path and reject.
  const vercelHost = present(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelHost) {
    return new URL(`https://${vercelHost}`);
  }

  return new URL(LOCAL_ORIGIN);
}

/**
 * A blank env var is treated as absent, not as a value. Hosting platforms hand
 * unset variables through as empty strings, and `new URL("")` throws.
 */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
