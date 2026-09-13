import { describe, expect, it, vi } from "vitest";

const cacheState = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock("next/cache", () => ({
  unstable_cache: (loader: () => unknown, _keys: string[], options: unknown) => {
    cacheState.options = options;
    return loader;
  },
}));
import { makeProduct } from "../../../../test/fixtures/product-view";
import { createCatalogSource } from "./source";

const visible = makeProduct({ id: 101, slug: "remera-classic" });
const unlisted = makeProduct({ id: 102, slug: "remera-black" });

describe("live catalog source", () => {
  it("configures one five-minute tagged aggregate cache", () => {
    expect(cacheState.options).toEqual({ revalidate: 300, tags: ["tiendanube-catalog"] });
  });

  it("shares one coherent snapshot across listing, PDP and colourway reads", async () => {
    const loadSnapshot = vi.fn(async () => ({
      listed: [visible],
      purchasable: [visible, unlisted],
      checkout: [],
    }));
    const source = createCatalogSource(loadSnapshot);

    await expect(source.getProducts()).resolves.toEqual([visible]);
    await expect(source.getProductByHandle("remera-black")).resolves.toEqual(unlisted);
    await expect(source.getProductByHandle("../../etc/passwd")).resolves.toBeNull();
    await source.getColourwayIndex();
    expect(loadSnapshot).toHaveBeenCalledTimes(4);
  });

  it("never exposes unlisted products through the listing", async () => {
    const source = createCatalogSource(async () => ({
      listed: [visible],
      purchasable: [visible, unlisted],
      checkout: [],
    }));

    const products = await source.getProducts();
    expect(products).toEqual([visible]);
    expect(products).not.toContain(unlisted);
  });

  it("resolves an unlisted product through getProductByHandle but returns null for a hidden slug", async () => {
    // `unlisted` is reachable and fully purchasable by direct URL (see the
    // three-state visibility rule in tiendanube.ts) — its PDP must resolve.
    // A `hidden` product is never in `purchasable` at all, so its slug must
    // 404 rather than resolve, which is exactly what `null` here drives.
    const source = createCatalogSource(async () => ({
      listed: [visible],
      purchasable: [visible, unlisted],
      checkout: [],
    }));

    await expect(source.getProductByHandle("remera-black")).resolves.toEqual(unlisted);
    await expect(source.getProductByHandle("remera-hidden")).resolves.toBeNull();
  });

  it("returns both visible and unlisted products from getPurchasableProducts, while getProducts stays visible-only", async () => {
    // This is the split the bug fix depends on: the cart catalog (built from
    // getPurchasableProducts) must see every variant a shopper can legally
    // add, while getProducts keeps answering the separate merchandising
    // question of what belongs on discovery surfaces.
    const source = createCatalogSource(async () => ({
      listed: [visible],
      purchasable: [visible, unlisted],
      checkout: [],
    }));

    await expect(source.getPurchasableProducts()).resolves.toEqual([visible, unlisted]);
    await expect(source.getProducts()).resolves.toEqual([visible]);
  });
});


