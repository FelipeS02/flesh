import { describe, expect, it, vi } from "vitest";
import { createCapiSender, readCapiConfig } from "./capi";

const config = { pixelId: "1234567890123456", accessToken: "secret-token", apiVersion: "v21.0" };

const event = {
  event_name: "InitiateCheckout" as const,
  event_time: 1_726_700_000,
  event_source_url: "https://flesh.com.ar/",
  user_data: { em: ["abc"] as [string], fn: ["def"] as [string], ln: ["ghi"] as [string] },
  custom_data: { currency: "ARS", value: 90000 },
};

const ok = () => new Response("{}", { status: 200 });

describe("readCapiConfig", () => {
  it("stays off until both the pixel and a server token are present", () => {
    expect(readCapiConfig({})).toBeNull();
    expect(
      readCapiConfig({ NEXT_PUBLIC_META_PIXEL_ID: "1234567890123456" }),
    ).toBeNull();
    expect(readCapiConfig({ META_CAPI_ACCESS_TOKEN: "secret-token" })).toBeNull();
  });

  it("reuses the pixel the browser already reports to", () => {
    expect(
      readCapiConfig({
        NEXT_PUBLIC_META_PIXEL_ID: "1234567890123456",
        META_CAPI_ACCESS_TOKEN: "secret-token",
      }),
    ).toMatchObject({ pixelId: "1234567890123456", accessToken: "secret-token" });
  });
});

describe("createCapiSender", () => {
  it("posts the event to the pixel's events endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());

    await createCapiSender(config, { fetchImpl })(event);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/1234567890123456/events",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ data: [event] });
  });

  /**
   * In the header, never the query string. A token on a URL is copied into
   * every access log and proxy trace it passes through, and this one can write
   * events to the ad account.
   */
  it("carries the token in the Authorization header and nowhere else", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());

    await createCapiSender(config, { fetchImpl })(event);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer secret-token");
    expect(url).not.toContain("secret-token");
    expect(init.body).not.toContain("secret-token");
  });

  it("gives up rather than hanging on to the shopper's request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());

    await createCapiSender(config, { fetchImpl })(event);

    expect(fetchImpl.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });

  it("reports a delivered event", async () => {
    expect(
      await createCapiSender(config, { fetchImpl: async () => ok() })(event),
    ).toBe(true);
  });

  /**
   * Every failure is the same answer, and none of them throws. This runs
   * inside the checkout: an analytics call that can reject is an analytics
   * call that can cost a sale.
   */
  it.each([
    ["a rejection from Meta", async () => new Response("{}", { status: 400 })],
    ["a server fault", async () => new Response("", { status: 500 })],
    [
      "a transport failure",
      async () => {
        throw new Error("network down");
      },
    ],
  ])("swallows %s", async (_label, fetchImpl) => {
    const send = createCapiSender(config, { fetchImpl: fetchImpl as never });

    await expect(send(event)).resolves.toBe(false);
  });
});
