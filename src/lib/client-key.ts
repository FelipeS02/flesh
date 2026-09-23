import "server-only";

const UNKNOWN_KEY = "unknown";

/**
 * The client address as the hosting platform observed it, or null.
 *
 * Every one of these headers is client-spoofable in general; they are trusted
 * here only because production runs on Vercel, which overwrites
 * `x-forwarded-for` and does not forward external IPs "to prevent IP
 * spoofing" (https://vercel.com/docs/headers/request-headers). Moving off
 * Vercel, or putting another proxy in front of it, voids that guarantee and
 * lets a caller mint a fresh rate-limit bucket per request.
 *
 * `x-vercel-forwarded-for` comes first because it carries the same address
 * but, per the same page, survives a proxy placed on top of Vercel, which
 * would otherwise rewrite `x-forwarded-for` to its own egress IP. From the
 * forwarded-for chain only the first hop is the client; the rest is whatever
 * each hop appended.
 */
export function readClientIp(headers: Headers): string | null {
  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const firstHop = headers.get(name)?.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || null;
}

/**
 * The rate limiters' accounting key. The "unknown" fallback degrades every
 * caller to one shared bucket, which in practice only happens in local dev
 * where no address header is set.
 */
export function readClientKey(headers: Headers): string {
  return readClientIp(headers) ?? UNKNOWN_KEY;
}
