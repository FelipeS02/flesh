import "server-only";

const UNKNOWN_KEY = "unknown";

/**
 * `x-forwarded-for` is client-spoofable unless the platform terminating TLS
 * overwrites it; on a platform that does (Vercel), the first hop is the
 * real client, so only that hop — never the whole header — is trusted.
 * The "unknown" fallback degrades every caller to one shared bucket, which
 * in practice only happens in local dev where neither header is set.
 */
export function readClientKey(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return UNKNOWN_KEY;
}
