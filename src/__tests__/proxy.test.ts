import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CLICK_ID_COOKIE_NAME } from "@/modules/analytics/meta/browser-ids";
import { config, proxy } from "../proxy";

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

describe("meta click id capture", () => {
  const original = {
    password: process.env.ACCESS_GATE_PASSWORD,
    secret: process.env.ACCESS_GATE_SECRET,
  };

  afterEach(() => {
    for (const [name, value] of [
      ["ACCESS_GATE_PASSWORD", original.password],
      ["ACCESS_GATE_SECRET", original.secret],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const request = (url: string) => new NextRequest(new URL(url));

  it("stores the click id an ad click arrives with", async () => {
    delete process.env.ACCESS_GATE_PASSWORD;

    const response = await proxy(
      request("https://flesh.com.ar/?fbclid=IwAR1abcDEF_ghi"),
    );

    expect(response.cookies.get(CLICK_ID_COOKIE_NAME)?.value).toMatch(
      /^fb\.2\.\d+\.IwAR1abcDEF_ghi$/,
    );
  });

  it("writes nothing for an ordinary visit", async () => {
    delete process.env.ACCESS_GATE_PASSWORD;

    const response = await proxy(request("https://flesh.com.ar/producto/x"));

    expect(response.cookies.get(CLICK_ID_COOKIE_NAME)).toBeUndefined();
  });

  it("refuses a click id outside the safe alphabet", async () => {
    delete process.env.ACCESS_GATE_PASSWORD;

    const response = await proxy(
      request("https://flesh.com.ar/?fbclid=abc%3Bdrop"),
    );

    expect(response.cookies.get(CLICK_ID_COOKIE_NAME)).toBeUndefined();
  });

  /**
   * The expensive one. An ad click landing on a gated store is redirected to
   * `/acceso`, and `fbclid` only ever rides the landing URL — so a capture that
   * skipped the redirect would throw away attribution for exactly the visitors
   * the campaign paid for.
   */
  it("keeps the click id when the gate redirects the visitor away", async () => {
    process.env.ACCESS_GATE_PASSWORD = "unlock-me";
    process.env.ACCESS_GATE_SECRET = "a-secret-long-enough-to-sign-with";

    const response = await proxy(
      request("https://flesh.com.ar/?fbclid=IwAR1abcDEF_ghi"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/acceso");
    expect(response.cookies.get(CLICK_ID_COOKIE_NAME)?.value).toContain(
      "IwAR1abcDEF_ghi",
    );
  });
});
