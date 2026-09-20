import { describe, expect, it, vi } from "vitest";
import { hasCompletedOrder } from "../order-status";

const CONFIG = {
  storeId: "123",
  accessToken: "token",
  userAgent: "flesh (test)",
  checkoutHost: "checkout.example.com",
};

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe("hasCompletedOrder", () => {
  // A draft order and the order it becomes share one id, so the same record is
  // readable either way. `number` is what separates them: Tiendanube leaves it
  // at 0 until the draft converts, and only then assigns the real order number.
  it("reads a real order number as a completed purchase", async () => {
    const fetchImpl = ok({ number: 103 });

    await expect(
      hasCompletedOrder(2070706008, { config: CONFIG, fetchImpl }),
    ).resolves.toBe(true);
  });

  it("reads the placeholder number as a checkout nobody finished", async () => {
    await expect(
      hasCompletedOrder(2070727754, { config: CONFIG, fetchImpl: ok({ number: 0 }) }),
    ).resolves.toBe(false);
  });

  it("asks only for the one field it needs, so no buyer data is ever fetched", async () => {
    const fetchImpl = ok({ number: 0 });

    await hasCompletedOrder(2070727754, { config: CONFIG, fetchImpl });

    const [requested] = fetchImpl.mock.calls[0] as unknown as [string | URL];
    const url = new URL(String(requested));
    expect(url.pathname).toBe("/v1/123/orders/2070727754");
    expect(url.searchParams.get("fields")).toBe("number");
  });

  // Every uncertain answer keeps the cart. A cart that outlives its purchase is
  // a nuisance; one emptied because a request failed is the shopper's work
  // thrown away, so the ambiguity always resolves the same way.
  it.each([
    ["a provider error", async () => new Response("", { status: 500 })],
    ["a missing order", async () => new Response("", { status: 404 })],
    ["an unparseable body", async () => new Response("not json", { status: 200 })],
    ["an absent number", async () => new Response(JSON.stringify({}), { status: 200 })],
    ["a thrown request", async () => { throw new Error("network"); }],
  ])("keeps the cart on %s", async (_label, fetchImpl) => {
    await expect(
      hasCompletedOrder(2070727754, { config: CONFIG, fetchImpl: fetchImpl as never }),
    ).resolves.toBe(false);
  });
});
