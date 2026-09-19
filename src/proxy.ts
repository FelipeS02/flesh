import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readAccessGateConfig } from "@/modules/access-gate/api/config";
import { ACCESS_GATE_COOKIE_NAME } from "@/modules/access-gate/domain/cookie-name";
import { verifyToken } from "@/modules/access-gate/domain/session";
import {
  CLICK_ID_COOKIE_NAME,
  CLICK_ID_MAX_AGE_SECONDS,
  formatClickId,
  subdomainIndexFor,
} from "@/modules/analytics/meta/browser-ids";

/**
 * `middleware.ts` is deprecated in Next 16 and renamed `proxy.ts`
 * (node_modules/next/dist/docs/.../proxy.md) — this file, not a
 * `middleware.ts`, is what Next actually loads.
 *
 * Runs on the Edge runtime, so `verifyToken`/`readAccessGateConfig` must
 * stay Web-Crypto-only (see `domain/session.ts`) — `node:crypto` does not
 * exist here.
 */
/**
 * Records the Meta click id on whatever response the gate decided to send.
 *
 * It has to happen here because `fbclid` only ever rides the landing URL,
 * while the event that needs it — the checkout submission — happens several
 * navigations later on a request that no longer carries it. The pixel writes
 * its own `_fbc`, but an ad-blocked visit has no pixel, and an ad-blocked
 * visitor arriving from a paid click is exactly the one worth attributing.
 *
 * Applied to the redirect too, not only to the pass-through: an ad click on a
 * gated store is sent to `/acceso`, and dropping the id there would discard
 * attribution for precisely the visitors the campaign paid for.
 *
 * Holds no decision of its own — the format, the alphabet and the subdomain
 * arithmetic live in the analytics module, where they are tested without a
 * NextRequest, and none of it reaches for `node:crypto`, which the Edge
 * runtime does not have.
 */
function withClickId(request: NextRequest, response: NextResponse): NextResponse {
  const fbclid = request.nextUrl.searchParams.get("fbclid");
  if (!fbclid) return response;

  const value = formatClickId(
    fbclid,
    Date.now(),
    subdomainIndexFor(request.nextUrl.hostname),
  );
  if (!value) return response;

  // Overwritten on every click on purpose: Meta attributes to the last one, so
  // keeping the first would credit a campaign the shopper has since left.
  response.cookies.set(CLICK_ID_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CLICK_ID_MAX_AGE_SECONDS,
  });

  return response;
}

export async function proxy(request: NextRequest) {
  return withClickId(request, await gate(request));
}

async function gate(request: NextRequest) {
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
