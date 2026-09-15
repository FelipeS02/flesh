import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readAccessGateConfig } from "@/modules/access-gate/api/config";
import { ACCESS_GATE_COOKIE_NAME } from "@/modules/access-gate/domain/cookie-name";
import { verifyToken } from "@/modules/access-gate/domain/session";

/**
 * `middleware.ts` is deprecated in Next 16 and renamed `proxy.ts`
 * (node_modules/next/dist/docs/.../proxy.md) — this file, not a
 * `middleware.ts`, is what Next actually loads.
 *
 * Runs on the Edge runtime, so `verifyToken`/`readAccessGateConfig` must
 * stay Web-Crypto-only (see `domain/session.ts`) — `node:crypto` does not
 * exist here.
 */
export async function proxy(request: NextRequest) {
  const config = readAccessGateConfig();

  // Disabled gate (api/config.ts: unset/empty ACCESS_GATE_PASSWORD) means
  // every request passes through untouched — a forgotten env var must never
  // lock the whole store out.
  if (!config.enabled) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_GATE_COOKIE_NAME)?.value;
  const authorized = token ? await verifyToken(token, config.secret, Date.now()) : false;

  if (authorized) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/acceso", request.url));
}

export const config = {
  matcher: [
    // Whatever this matches gets redirected to `/acceso` without the cookie,
    // so two exclusions are load-bearing rather than cosmetic:
    // `api/` keeps the Tiendanube webhook reachable — it is a server-to-server
    // POST with no cookie, and a 307 into an HTML page reads as a failed
    // delivery; and `acceso(?:/|$)` is anchored so the gate route is skipped
    // without also swallowing a future `/accesorios`.
    "/((?!acceso(?:/|$)|api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|mp4|webm|txt|xml|json)$).*)",
  ],
};
