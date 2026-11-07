import { describe, expect, it, vi } from "vitest";
import { createTiendanubePreviewReader } from "../tiendanube";

const config = {
  storeId: "123",
  accessToken: "top-secret-token",
  userAgent: "FLESH Storefront (ops@example.com)",
  checkoutHost: "checkout.example.com",
};

function definition(owners: unknown[], valueType = "boolean") {
  return {
    id: "preview",
    namespace: "custom",
    slug: "preview",
    key: "custom/preview",
    name: "preview",
    value_type: valueType,
    owner_resource: "products",
    owners,
    has_more: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function reader(fetchImpl: ReturnType<typeof vi.fn>) {
  return createTiendanubePreviewReader(config, {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async () => {},
    random: () => 0,
  });
}

describe("createTiendanubePreviewReader", () => {
  it("reads the preview owners uncached and authenticated", async () => {
    const fetchImpl = vi.fn(async () => json(definition([])));

    await reader(fetchImpl)(101);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.tiendanube.com/unstable/123/products/custom-fields/custom/preview/owners?limit=200");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer top-secret-token");
  });

  it("is true only for a product whose owner value is on", async () => {
    const fetchImpl = vi.fn(async () =>
      json(definition([{ entity_id: "101", value: true }, { entity_id: "102", value: false }])));

    await expect(reader(fetchImpl)(101)).resolves.toBe(true);
    await expect(reader(fetchImpl)(102)).resolves.toBe(false);
    await expect(reader(fetchImpl)(103)).resolves.toBe(false);
  });

  it("reads a missing definition (404) as no previews", async () => {
    const fetchImpl = vi.fn(async () => json({ code: 404 }, 404));

    await expect(reader(fetchImpl)(101)).resolves.toBe(false);
  });

  // The launch gate must fail closed: a transient error read as "released"
  // would mail shoppers about a product that is still unreleased.
  it("throws on any failure other than a 404", async () => {
    const serverError = vi.fn(async () => json({}, 500));
    await expect(reader(serverError)(101)).rejects.toThrow(/preview/);

    const forbidden = vi.fn(async () => json({}, 403));
    await expect(reader(forbidden)(101)).rejects.toThrow(/preview/);

    const malformed = vi.fn(async () => json({ nope: true }));
    await expect(reader(malformed)(101)).rejects.toThrow(/preview/);
  });

  it("rejects a definition that is not a boolean", async () => {
    const fetchImpl = vi.fn(async () => json(definition([], "object")));

    await expect(reader(fetchImpl)(101)).rejects.toThrow(/definition contract error for preview/);
  });
});
