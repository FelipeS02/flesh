import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLICK_ID_COOKIE_NAME, PIXEL_COOKIE_NAME } from "../browser-ids";
import type { CapiEvent } from "../capi";

const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Headers(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = request.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  })),
  headers: vi.fn(async () => request.headers),
}));

// The real `after` only runs its callback once the response is sent, which a
// test has no response to wait for. Running it inline is the closest honest
// stand-in: it keeps the ORDERING claim testable — whatever the callback
// reads must already have been captured before it was scheduled.
const scheduled = vi.hoisted(() => ({ callbacks: [] as (() => unknown)[] }));
vi.mock("next/server", () => ({
  after: (callback: () => unknown) => {
    scheduled.callbacks.push(callback);
  },
}));

const capi = vi.hoisted(() => ({
  config: null as unknown,
  sent: [] as CapiEvent[],
}));

vi.mock("../capi", () => ({
  readCapiConfig: () => capi.config,
  createCapiSender: () => async (event: CapiEvent) => {
    capi.sent.push(event);
    return true;
  },
}));

const { reportCheckoutStarted } = await import("../report-checkout");

const BUYER = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const LINES = [
  {
    variantId: 12,
    quantity: 2,
    price: { amount: 150_000, currency: "ARS" as const },
  },
];

async function flush(): Promise<void> {
  for (const callback of scheduled.callbacks) await callback();
  scheduled.callbacks = [];
}

beforeEach(() => {
  request.cookies = new Map();
  request.headers = new Headers();
  scheduled.callbacks = [];
  capi.sent = [];
  capi.config = { pixelId: "1", accessToken: "t", apiVersion: "v21.0" };
});

describe("reportCheckoutStarted", () => {
  it("sends nothing at all when no access token is configured", async () => {
    capi.config = null;

    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    // Not "sends an empty event": the dark path must not schedule work either,
    // because an unconfigured store should cost the checkout nothing.
    expect(scheduled.callbacks).toHaveLength(0);
    expect(capi.sent).toHaveLength(0);
  });

  it("carries the click id, the pixel cookie and the request metadata", async () => {
    request.cookies.set(CLICK_ID_COOKIE_NAME, "fb.1.1700000000000.abc");
    request.cookies.set(PIXEL_COOKIE_NAME, "fb.1.1700000000000.99");
    request.headers = new Headers({
      "user-agent": "Mozilla/5.0",
      referer: "https://flesh.ar/carrito",
    });

    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    expect(capi.sent[0]?.user_data).toMatchObject({
      fbc: "fb.1.1700000000000.abc",
      fbp: "fb.1.1700000000000.99",
      client_user_agent: "Mozilla/5.0",
    });
    expect(capi.sent[0]?.event_source_url).toBe("https://flesh.ar/carrito");
  });

  it("takes only the first hop of x-forwarded-for", async () => {
    request.headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2",
    });

    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    // The rest of the chain is whatever each proxy appended. Meta wants the
    // client; sending the edge would attribute every buyer to one address.
    expect(capi.sent[0]?.user_data.client_ip_address).toBe("203.0.113.7");
  });

  it("prefers the address Vercel observed over a forwarded-for a proxy could rewrite", async () => {
    request.headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    });

    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    expect(capi.sent[0]?.user_data.client_ip_address).toBe("203.0.113.7");
  });

  it("sends no address at all when none is forwarded, never a placeholder", async () => {
    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    // The rate limiters key an unknown caller as "unknown"; Meta must never
    // receive that string as an IP.
    expect(capi.sent[0]?.user_data).not.toHaveProperty("client_ip_address");
  });

  it("never lets a raw email or name reach the payload", async () => {
    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });
    await flush();

    const serialised = JSON.stringify(capi.sent[0]);

    expect(serialised).not.toContain("ada@example.com");
    expect(serialised).not.toContain("Ada");
    expect(serialised).not.toContain("Lovelace");
  });

  it("reads the request before scheduling, not inside the callback", async () => {
    request.cookies.set(CLICK_ID_COOKIE_NAME, "fb.1.1700000000000.abc");

    await reportCheckoutStarted({ buyer: BUYER, lines: LINES });

    // The whole reason `after` is safe here. By the time the callback runs the
    // request is gone, so anything read from it at that point would throw —
    // clearing it now proves the event was already assembled.
    request.cookies = new Map();
    request.headers = new Headers();
    await flush();

    expect(capi.sent[0]?.user_data.fbc).toBe("fb.1.1700000000000.abc");
  });

  it("stays silent when the event cannot be built", async () => {
    // No lines: `toInitiateCheckoutEvent` throws. A measurement must never be
    // the reason a checkout does not happen, so this resolves like any other.
    await expect(
      reportCheckoutStarted({ buyer: BUYER, lines: [] }),
    ).resolves.toBeUndefined();

    expect(scheduled.callbacks).toHaveLength(0);
  });
});
