import { describe, expect, it, vi } from "vitest";
import { createTiendanubeDraftOrderCheckout } from "./checkout.tiendanube";

const CONFIG = {
  storeId: "123456",
  accessToken: "secret-token",
  userAgent: "FLESH (dev@example.com)",
};

const REQUEST = {
  buyer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  products: [{ variantId: 201, quantity: 2 }],
};

describe("createTiendanubeDraftOrderCheckout", () => {
  it("creates one unpaid draft order and returns its HTTPS checkout URL", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
      id: 99,
      checkout_url: "https://checkout.example.com/checkout/99/token",
    }), { status: 201, headers: { "content-type": "application/json" } });
    });

    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, { fetchImpl, timeoutMs: 50 });

    await expect(checkout(REQUEST)).resolves.toBe("https://checkout.example.com/checkout/99/token");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.tiendanube.com/v1/123456/draft_orders");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: "Bearer secret-token",
        "content-type": "application/json",
        "user-agent": "FLESH (dev@example.com)",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      contact_name: "Ada",
      contact_lastname: "Lovelace",
      contact_email: "ada@example.com",
      payment_status: "unpaid",
      products: [{ variant_id: 201, quantity: 2 }],
    });
  });

  it.each([
    [{ checkout_url: "http://checkout.example.com/unsafe" }, "non-HTTPS"],
    [{ checkout_url: "not a URL" }, "malformed"],
    [{ id: 99 }, "missing"],
  ])("returns a sanitized failure for a %s checkout URL", async (body, label) => {
    void label;
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, {
      fetchImpl: async () => new Response(JSON.stringify(body), { status: 201 }),
    });

    await expect(checkout(REQUEST)).rejects.toThrow("Tiendanube checkout request failed.");
  });

  it("does not retry a failed mutation or expose the token", async () => {
    const fetchImpl = vi.fn(async () => new Response("upstream details", { status: 503 }));
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, { fetchImpl });

    const error = await checkout(REQUEST).catch((caught: unknown) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(error)).toBe("TiendanubeCheckoutError: Tiendanube checkout request failed.");
    expect(String(error)).not.toContain(CONFIG.accessToken);
    expect(String(error)).not.toContain("upstream details");
  });

  it("turns an ambiguous network failure into one sanitized error without retrying", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("socket with secret-token"); });
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, { fetchImpl });

    const error = await checkout(REQUEST).catch((caught: unknown) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(error)).toBe("TiendanubeCheckoutError: Tiendanube checkout request failed.");
  });
});




