import { describe, expect, it, vi } from "vitest";

const catalogProduct = vi.hoisted(() => ({
  id: 101,
  slug: "remera-classic",
  title: "Remera Classic",
  descriptionHtml: "<p>Remera</p>",
  images: [],
  axes: [],
  variants: [
    {
      id: 201,
      combination: [],
      price: { amount: 10000, currency: "ARS" },
      compareAt: null,
      inStock: true,
      stockManagement: false,
      stock: null,
    },
  ],
  defaultVariantId: 201,
  inStock: true,
  tags: [],
  colourway: null,
  fit: null,
  sizeChart: null,
}));

vi.mock("./api/source", () => ({
  getProducts: async () => [catalogProduct],
  getProductByHandle: async (slug: string) => slug === catalogProduct.slug ? catalogProduct : null,
  getColourwayIndex: async () => new Map(),
}));
import {
  applyRate,
  getPricingPolicy,
  getProductByHandle,
  getProducts,
  transferBreakdown,
} from ".";

// This suite guards the module boundary itself, not the mapper (that is
// `domain/map.test.ts`). The question it answers is narrower and structural:
// does anything wire-shaped survive the trip out through `index.ts`? A
// consumer never sees `map.ts`; it sees exactly what these functions return.

describe("catalog module index — the single crossing point", () => {
  it("returns locale-resolved domain products, never language-keyed wire objects", async () => {
    const [first] = await getProducts();

    expect(first).toBeDefined();
    expect(typeof first!.title).toBe("string");
    expect(typeof first!.slug).toBe("string");
    // `name`, `handle` and `visibility` are wire-only fields. Their presence
    // would mean the raw Tiendanube shape leaked past the port.
    expect(first).not.toHaveProperty("name");
    expect(first).not.toHaveProperty("handle");
    expect(first).not.toHaveProperty("visibility");
  });

  it("returns money as integer minor units, never a wire price string", async () => {
    const [first] = await getProducts();
    const variant = first!.variants[0];

    expect(variant).toBeDefined();
    expect(typeof variant!.price).toBe("object");
    expect(Number.isInteger(variant!.price.amount)).toBe(true);
    expect(variant!.price.currency).toBe("ARS");
  });

  it("resolves a handle to the same domain view shape as the listing", async () => {
    const [first] = await getProducts();
    const found = await getProductByHandle(first!.slug);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(first!.id);
    expect(found!.title).toBe(first!.title);
  });

  it("returns null for an unknown handle", async () => {
    await expect(getProductByHandle("no-existe")).resolves.toBeNull();
  });
});

// Task 1a.5: the pricing policy port and its pure helpers cross the same
// single crossing point as the catalog port, not a second entry point.
describe("catalog module index — pricing re-exports", () => {
  it("exposes the pricing policy at the same rate api/pricing.ts returns", () => {
    expect(getPricingPolicy()).toEqual({ transferRateBp: 1000 });
  });

  it("exposes applyRate/transferBreakdown as the same pure functions lib/pricing.ts defines", () => {
    const subtotal = { amount: 8_100_000, currency: "ARS" };
    const { transferRateBp } = getPricingPolicy();

    const breakdown = transferBreakdown(subtotal, transferRateBp);
    const applied = applyRate(subtotal, transferRateBp);

    // These figures are the artboard case from lib/pricing.test.ts — proving
    // this is not a second, divergent implementation reachable via the
    // barrel, but the exact same one.
    expect(breakdown).toEqual({
      discount: { amount: 810_000, currency: "ARS" },
      total: { amount: 7_290_000, currency: "ARS" },
    });
    expect(applied).toEqual({ amount: 7_290_000, currency: "ARS" });
  });
});
