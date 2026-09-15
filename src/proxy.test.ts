import { describe, expect, it } from "vitest";
import { config } from "./proxy";

/**
 * The matcher is the gate's real blast radius: whatever it matches gets
 * redirected to `/acceso` when the cookie is missing. Two failures are silent
 * and expensive — swallowing `/api` breaks the Tiendanube webhook (a
 * server-to-server POST carries no cookie and would follow a 307 into an HTML
 * page), and a bare `acceso` prefix would also swallow a future `/accesorios`.
 * Next requires the matcher to be a literal, so the pattern is asserted here
 * rather than built from a shared constant.
 */
const matches = (pathname: string) => new RegExp(`^${config.matcher[0]}$`).test(pathname);

describe("proxy matcher", () => {
  it.each(["/", "/producto/remera-negra", "/devoluciones", "/accesorios"])(
    "gates %s",
    (pathname) => {
      expect(matches(pathname)).toBe(true);
    },
  );

  it.each([
    "/acceso",
    "/api/webhooks/tiendanube",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/password_ilustration.webp",
  ])("lets %s through", (pathname) => {
    expect(matches(pathname)).toBe(false);
  });
});
