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
      all: [visible, unlisted],
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
      all: [visible, unlisted],
    }));

    const products = await source.getProducts();
    expect(products).toEqual([visible]);
    expect(products).not.toContain(unlisted);
  });
});
