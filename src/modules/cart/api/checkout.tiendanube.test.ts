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

    await expect(checkout(REQUEST)).resolves.toEqual({ status: "redirect", url: "https://checkout.example.com/checkout/99/token" });
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

  it.each([
    [{ variant_ids: [201, 202] }, "the id list alone"],
    [{ variant_errors: { "201": "Variant does not have enough stock", "202": "Variant does not have enough stock" } }, "the per-variant error map alone"],
    [{ variant_ids: [201], variant_errors: { "202": "Variant does not have enough stock" } }, "both fields merged"],
    [{ variant_ids: ["201", 202, 202] }, "string and duplicate ids"],
  ])("maps a 422 naming refused variants into a rejection carrying their ids, from %s", async (body, label) => {
    void label;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 422 }));
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, { fetchImpl });

    await expect(checkout(REQUEST)).resolves.toEqual({ status: "rejected", variantIds: [201, 202] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ code: 422, message: "contact_email is invalid" }, "a 422 about something other than variants"],
    [{ variant_ids: [], variant_errors: {} }, "a 422 naming no variant at all"],
    [{ variant_ids: ["not-an-id", 0, -3, 1.5] }, "a 422 whose ids are not usable variant ids"],
  ])("falls back to the sanitized failure for %s", async (body, label) => {
    void label;
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, {
      fetchImpl: async () => new Response(JSON.stringify(body), { status: 422 }),
    });

    await expect(checkout(REQUEST)).rejects.toThrow("Tiendanube checkout request failed.");
  });

  it("does not leak the provider body when a 422 is not valid JSON", async () => {
    const checkout = createTiendanubeDraftOrderCheckout(CONFIG, {
      fetchImpl: async () => new Response("upstream details with secret-token", { status: 422 }),
    });

    const error = await checkout(REQUEST).catch((caught: unknown) => caught);

    expect(String(error)).toBe("TiendanubeCheckoutError: Tiendanube checkout request failed.");
    expect(String(error)).not.toContain(CONFIG.accessToken);
  });
});




