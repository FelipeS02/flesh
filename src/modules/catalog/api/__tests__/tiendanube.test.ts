import { afterEach, describe, expect, it, vi } from "vitest";
import { readTiendanubeConfig } from "../config";
import { createTiendanubeCatalogLoader } from "../tiendanube";

const config = {
  storeId: "123",
  accessToken: "top-secret-token",
  userAgent: "FLESH Storefront (ops@example.com)",
  checkoutHost: "checkout.example.com",
};

const product = {
  id: 101,
  name: { es: "Remera" },
  description: { es: "<p>Descripción</p>" },
  handle: { es: "remera" },
  attributes: [{ es: "Talle" }],
  variants: [{
    id: 201,
    product_id: 101,
    price: "100.00",
    promotional_price: null,
    cost: null,
    stock: 2,
    stock_management: true,
    weight: "0.2",
    values: [{ es: "M" }],
    sku: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }],
  images: [],
  categories: [],
  tags: "",
  published: true,
  visibility: "visible",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function owners(slug: string, valueType: "object" | "object[]", entries: unknown[] = []) {
  return {
    id: slug,
    namespace: "custom",
    slug,
    key: `custom/${slug}`,
    name: slug,
    value_type: valueType,
    owner_resource: "products",
    owners: entries,
    has_more: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

function successfulFetch(products: unknown[] = [product]) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer top-secret-token");
    expect(new Headers(init?.headers).get("user-agent")).toBe(config.userAgent);
    if (url.includes("/2025-03/")) return json(products);
    if (url.includes("/colourway/")) {
      return json(owners("colourway", "object", [{ entity_id: "101", value: { group: "tee", hex: "#000", color_name: "Black" } }]));
    }
    if (url.includes("/fit/")) return json(owners("fit", "object", [{ entity_id: "101", value: { type: "top", position: 50 } }]));
    return json(owners("size_chart", "object[]", [{ entity_id: "101", value: [{ size: "M", chest_width: 50 }] }]));
  });
}

afterEach(() => vi.restoreAllMocks());

describe("readTiendanubeConfig", () => {
  it("names invalid variables without leaking their values", () => {
    expect(() => readTiendanubeConfig({
      TIENDANUBE_STORE_ID: "not-an-id",
      TIENDANUBE_ACCESS_TOKEN: "should-never-appear",
      TIENDANUBE_USER_AGENT: "",
    })).toThrow(/TIENDANUBE_STORE_ID.*TIENDANUBE_USER_AGENT/);

    try {
      readTiendanubeConfig({ TIENDANUBE_ACCESS_TOKEN: "should-never-appear" });
    } catch (error) {
      expect(String(error)).not.toContain("should-never-appear");
    }
  });

  it("requires a bare exact checkout hostname", () => {
    const base = {
      TIENDANUBE_STORE_ID: "123",
      TIENDANUBE_ACCESS_TOKEN: "secret",
      TIENDANUBE_USER_AGENT: "FLESH (ops@example.com)",
    };

    expect(() => readTiendanubeConfig(base)).toThrow(
      /TIENDANUBE_CHECKOUT_HOST/,
    );
    expect(() =>
      readTiendanubeConfig({
        ...base,
        TIENDANUBE_CHECKOUT_HOST: "https://checkout.example.com/path",
      }),
    ).toThrow(/TIENDANUBE_CHECKOUT_HOST/);
    expect(
      readTiendanubeConfig({
        ...base,
        TIENDANUBE_CHECKOUT_HOST: "checkout.example.com",
      }).checkoutHost,
    ).toBe("checkout.example.com");
  });
});

describe("Tiendanube catalog loader", () => {
  it("loads one stable product page and the three unstable owners resources", async () => {
    const fetchImpl = successfulFetch();
    const snapshot = await createTiendanubeCatalogLoader(config, { fetchImpl })();

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://api.tiendanube.com/2025-03/123/products?visibility=visible%2Cunlisted&per_page=200");
    expect(fetchImpl.mock.calls.slice(1).map(([url]) => String(url))).toEqual([
      "https://api.tiendanube.com/unstable/123/products/custom-fields/custom/colourway/owners?limit=200",
      "https://api.tiendanube.com/unstable/123/products/custom-fields/custom/fit/owners?limit=200",
      "https://api.tiendanube.com/unstable/123/products/custom-fields/custom/size_chart/owners?limit=200",
    ]);
    expect(snapshot.listed).toHaveLength(1);
    expect(snapshot.purchasable[0]).toMatchObject({ slug: "remera", colourway: { group: "tee" }, fit: { type: "top" } });
    expect(snapshot.purchasable[0]?.sizeChart).toEqual([{ size: "M", measurements: { chest_width: 50 } }]);
  });

  it("follows safe product Link pagination and rejects an escaping link", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(json([product], { headers: { link: '<https://api.tiendanube.com/2025-03/123/products?page=2&per_page=200&visibility=visible%2Cunlisted>; rel="next"' } }));
    fetchImpl.mockResolvedValueOnce(json([{ ...product, id: 102, handle: { es: "otra" }, variants: [{ ...product.variants[0], id: 202, product_id: 102 }] }]));
    await createTiendanubeCatalogLoader(config, { fetchImpl })();
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("page=2");

    const escaping = successfulFetch();
    escaping.mockResolvedValueOnce(json([product], { headers: { link: '<https://evil.example/products?page=2>; rel="next"' } }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: escaping })()).rejects.toThrow(/pagination/i);
  });

  it("caps product pagination even when every Link remains unique", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const current = Number(url.searchParams.get("page") ?? "1");
      const next = new URL("https://api.tiendanube.com/2025-03/123/products");
      next.searchParams.set("page", String(current + 1));
      next.searchParams.set("per_page", "200");
      next.searchParams.set("visibility", "visible,unlisted");
      return json([], { headers: { link: `<${next.href}>; rel="next"` } });
    });

    await expect(createTiendanubeCatalogLoader(config, { fetchImpl })()).rejects.toThrow(/pagination/i);
    expect(fetchImpl).toHaveBeenCalledTimes(50);
  });

  it("uses opaque owner cursors and rejects missing or repeated cursors", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(json([product]));
    fetchImpl.mockResolvedValueOnce(json({ ...owners("colourway", "object"), has_more: true, next_cursor: "opaque+/=" }));
    fetchImpl.mockResolvedValueOnce(json(owners("colourway", "object")));
    await createTiendanubeCatalogLoader(config, { fetchImpl })();
    expect(String(fetchImpl.mock.calls[2]![0])).toContain("after=opaque%2B%2F%3D");

    const missing = successfulFetch();
    missing.mockResolvedValueOnce(json([product]));
    missing.mockResolvedValueOnce(json({ ...owners("colourway", "object"), has_more: true }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: missing })()).rejects.toThrow(/cursor/i);

    const repeated = successfulFetch();
    repeated.mockResolvedValueOnce(json([product]));
    repeated.mockResolvedValueOnce(json({ ...owners("colourway", "object"), has_more: true, next_cursor: "same" }));
    repeated.mockResolvedValueOnce(json({ ...owners("colourway", "object"), has_more: true, next_cursor: "same" }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: repeated })()).rejects.toThrow(/cursor/i);
  });

  it("rejects custom-field definition drift between owner pages", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(json([product]));
    fetchImpl.mockResolvedValueOnce(json({ ...owners("colourway", "object"), has_more: true, next_cursor: "next" }));
    fetchImpl.mockResolvedValueOnce(json({ ...owners("colourway", "object"), id: "changed" }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl })()).rejects.toThrow(/changed during pagination/i);
  });

  it("retries only transient failures and keeps errors redacted", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(new Response("sensitive upstream body", { status: 429, headers: { "x-rate-limit-reset": "1000" } }));
    await createTiendanubeCatalogLoader(config, { fetchImpl, sleep, random: () => 0 })();
    expect(sleep).toHaveBeenCalledWith(1000);

    const unauthorized = vi.fn(async () => new Response("top-secret-token sensitive", { status: 401 }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: unauthorized })()).rejects.not.toThrow(/top-secret-token|sensitive/);
    expect(unauthorized).toHaveBeenCalledTimes(1);

    const unavailable = vi.fn(async () => new Response("private", { status: 503 }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: unavailable, sleep })()).rejects.toThrow(/status 503/);
    expect(unavailable).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After for 5xx and refuses an instruction beyond the retry-wait budget", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 503, headers: { "retry-after": "2" } }));
    await createTiendanubeCatalogLoader(config, { fetchImpl, sleep, random: () => 0.5 })();
    expect(sleep).toHaveBeenCalledWith(2050);

    const excessive = vi.fn(async () => new Response("private", { status: 503, headers: { "retry-after": "120" } }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: excessive, sleep })()).rejects.toThrow(/retry-wait budget/i);
    expect(excessive).toHaveBeenCalledTimes(1);
  });

  it("aborts bounded attempts that exceed the request timeout", async () => {
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    await expect(createTiendanubeCatalogLoader(config, {
      fetchImpl,
      sleep: async () => undefined,
      timeoutMs: 1,
    })()).rejects.toThrow(/request failed/i);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("keeps the timeout active while the response body is consumed", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!init?.signal?.aborted) throw new Error("body outlived timeout");
        throw new DOMException("aborted", "AbortError");
      },
    }) as unknown as Response);

    await expect(createTiendanubeCatalogLoader(config, {
      fetchImpl,
      sleep: async () => undefined,
      timeoutMs: 1,
    })()).rejects.toThrow(/request failed/i);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("isolates malformed optional owners but rejects malformed envelopes", async () => {
    const warn = vi.fn();
    const fetchImpl = successfulFetch();
    fetchImpl.mockResolvedValueOnce(json([product]));
    fetchImpl.mockResolvedValueOnce(json(owners("colourway", "object", [
      { entity_id: "not-an-id", value: { group: "tee", hex: "#111", color_name: "Invalid" } },
      { entity_id: "101", value: { group: "tee", hex: "#000", color_name: "Black" } },
    ])));
    const snapshot = await createTiendanubeCatalogLoader(config, { fetchImpl, warn })();
    expect(snapshot.purchasable[0]?.colourway?.name).toBe("Black");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("colourway"));
    expect(String(warn.mock.calls[0])).not.toContain("#000");

    const malformed = successfulFetch();
    malformed.mockResolvedValueOnce(json([product]));
    malformed.mockResolvedValueOnce(json({ owners: [] }));
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl: malformed })()).rejects.toThrow(/contract/i);
  });

  it("rejects a non-empty product response when every product is malformed", async () => {
    const fetchImpl = successfulFetch([{ id: 1 }]);
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl })()).rejects.toThrow(/zero valid products/i);
  });

  it("rejects the whole refresh when even one required product is malformed", async () => {
    const fetchImpl = successfulFetch([product, { ...product, id: "drifted" }]);
    await expect(createTiendanubeCatalogLoader(config, { fetchImpl })()).rejects.toThrow(/product payload/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a reachable unlisted product checkout-eligible with correctly mapped price and stock, while excluding it from listed", async () => {
    const unlistedProduct = {
      ...product,
      id: 102,
      handle: { es: "remera-unlisted" },
      visibility: "unlisted",
      variants: [{ ...product.variants[0], id: 202, product_id: 102, price: "50.00", stock: null, stock_management: false }],
    };
    const fetchImpl = successfulFetch([product, unlistedProduct]);
    const snapshot = await createTiendanubeCatalogLoader(config, { fetchImpl })();

    expect(snapshot.listed.map((view) => view.id)).toEqual([101]);
    expect(snapshot.purchasable.map((view) => view.id).sort()).toEqual([101, 102]);
    expect(snapshot.checkout.map((item) => item.productId).sort()).toEqual([101, 102]);
    expect(snapshot.checkout.find((item) => item.productId === 101)?.variants).toEqual([
      { productId: 101, variantId: 201, price: { amount: 10000, currency: "ARS" }, stockManagement: true, stock: 2 },
    ]);
    expect(snapshot.checkout.find((item) => item.productId === 102)?.variants).toEqual([
      { productId: 102, variantId: 202, price: { amount: 5000, currency: "ARS" }, stockManagement: false, stock: null },
    ]);
  });

  it("excludes a hidden product from purchasable and checkout, keeping only visible/unlisted purchasable", async () => {
    // `hidden` means "not shown anywhere and NOT purchasable" (see the
    // three-state visibility rule in tiendanube.ts). Today the fetch URL
    // already asks for `visibility=visible,unlisted`, so a hidden product
    // never actually reaches this loop in production — this test proves the
    // loop enforces the rule itself, independent of that query param, so a
    // stray hidden product from the API can never become orderable.
    const unlistedProduct = {
      ...product,
      id: 102,
      handle: { es: "remera-unlisted" },
      visibility: "unlisted",
      variants: [{ ...product.variants[0], id: 202, product_id: 102 }],
    };
    const hiddenProduct = {
      ...product,
      id: 103,
      handle: { es: "remera-hidden" },
      visibility: "hidden",
      variants: [{ ...product.variants[0], id: 203, product_id: 103 }],
    };
    const fetchImpl = successfulFetch([product, unlistedProduct, hiddenProduct]);
    const snapshot = await createTiendanubeCatalogLoader(config, { fetchImpl })();

    expect(snapshot.purchasable.map((view) => view.id).sort()).toEqual([101, 102]);
    expect(snapshot.listed.map((view) => view.id)).toEqual([101]);
    expect(snapshot.checkout.map((item) => item.productId).sort()).toEqual([101, 102]);
  });
});
