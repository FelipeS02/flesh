import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => requestHeaders.current),
}));
vi.mock("../capi", () => ({
  readCapiConfig: () => ({ pixelId: "1", accessToken: "t" }),
  createCapiSender: () => vi.fn(),
}));
vi.mock("../initiate-checkout", () => ({ toInitiateCheckoutEvent: vi.fn(() => ({})) }));

import { toInitiateCheckoutEvent } from "../initiate-checkout";
import { reportCheckoutStarted } from "../report-checkout";

const input = {
  buyer: { firstName: "Ana", lastName: "Paz", email: "ana@example.com" },
  lines: [],
};

describe("reportCheckoutStarted client IP", () => {
  beforeEach(() => vi.mocked(toInitiateCheckoutEvent).mockClear());

  it("reports the address Vercel observed, not a forwarded-for value a proxy could rewrite", async () => {
    requestHeaders.current = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    });

    await reportCheckoutStarted(input);

    expect(vi.mocked(toInitiateCheckoutEvent).mock.calls[0]?.[0]).toMatchObject({
      clientIpAddress: "203.0.113.7",
    });
  });

  it("sends no address at all when none is forwarded, never a placeholder", async () => {
    requestHeaders.current = new Headers();

    await reportCheckoutStarted(input);

    expect(vi.mocked(toInitiateCheckoutEvent).mock.calls[0]?.[0]).toMatchObject({
      clientIpAddress: null,
    });
  });
});
