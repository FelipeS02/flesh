import { describe, expect, it, vi } from "vitest";
import { createTiendanubeProductReader } from "../tiendanube";

const config = {
  storeId: "123",
  accessToken: "top-secret-token",
  userAgent: "FLESH Storefront (ops@example.com)",
  checkoutHost: "checkout.example.com",
};

const wireProduct = {
  id: 101,
  name: { es: "Remera Oversize" },
  description: { es: "<p>x</p>" },
  handle: { es: "remera-oversize" },
  attributes: [{ es: "Color" }, { es: "Talle" }],
  variants: [
    variant(201, ["Negro", "M"], { stock: 0, stock_management: true }),
    variant(202, ["Negro", "L"], { stock: 3, stock_management: true }),
    variant(203, ["Blanco", "M"], { stock: null, stock_management: true }),
    variant(204, ["Blanco", "L"], { stock: null, stock_management: false }),
  ],
  images: [
    { id: 2, product_id: 101, src: "https://cdn.test/second.jpg", position: 2 },
    { id: 1, product_id: 101, src: "https://cdn.test/first.jpg", position: 1 },
  ],
  categories: [],
  tags: "",
  published: true,
  visibility: "visible",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function variant(id: number, values: string[], stock: { stock: number | null; stock_management: boolean }) {
  return {
    id,
    product_id: 101,
    price: "27000.00",
    promotional_price: null,
    cost: null,
    weight: "0.2",
    values: values.map((es) => ({ es })),
    sku: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...stock,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function reader(fetchImpl: ReturnType<typeof vi.fn>) {
  return createTiendanubeProductReader(config, { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {}, random: () => 0 });
}

describe("createTiendanubeProductReader", () => {
  it("reads the single product by id, uncached and authenticated", async () => {
    const fetchImpl = vi.fn(async () => json(wireProduct));

    await reader(fetchImpl)(101);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.tiendanube.com/2025-03/123/products/101");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer top-secret-token");
  });

  it("maps slug, title, first image by position and per-variant label and stock", async () => {
    const product = await reader(vi.fn(async () => json(wireProduct)))(101);

    expect(product?.slug).toBe("remera-oversize");
    expect(product?.title).toBe("Remera Oversize");
    expect(product?.images[0]?.src).toBe("https://cdn.test/first.jpg");
    expect(product?.variants.map((v) => [v.id, v.combination.join(" / "), v.inStock])).toEqual([
      [201, "Negro / M", false],
      [202, "Negro / L", true],
      // Managed stock with a null count is sold out; unmanaged is always available.
      [203, "Blanco / M", false],
      [204, "Blanco / L", true],
    ]);
  });

  it("returns null for a product that no longer exists", async () => {
    const fetchImpl = vi.fn(async () => json({ code: 404 }, 404));

    await expect(reader(fetchImpl)(101)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws on a payload that is not a product", async () => {
    await expect(reader(vi.fn(async () => json({ nope: true })))(101)).rejects.toThrow(/contract error/i);
  });

  it("retries a transient failure like the snapshot loader does", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(wireProduct));

    await expect(reader(fetchImpl)(101)).resolves.toMatchObject({ id: 101 });
  });
});
