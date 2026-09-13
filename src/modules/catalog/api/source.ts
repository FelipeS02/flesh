import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { buildColourwayIndex, type ColourwayIndex } from "../domain/colourway";
import type { ProductView } from "../domain/product";
import { readTiendanubeConfig } from "./config";
import type { CatalogPort, CheckoutProduct } from "./port";
import { createTiendanubeCatalogLoader, type CatalogSnapshot } from "./tiendanube";

export const CATALOG_CACHE_TAG = "tiendanube-catalog";

const loadPersistentSnapshot = unstable_cache(
  async () => createTiendanubeCatalogLoader(readTiendanubeConfig())(),
  ["tiendanube-catalog-snapshot-v1"],
  { revalidate: 300, tags: [CATALOG_CACHE_TAG] },
);
const getSnapshot = cache(loadPersistentSnapshot);

export function createCatalogSource(loadSnapshot: () => Promise<CatalogSnapshot>): CatalogPort {
  return {
    async getProducts() { return (await loadSnapshot()).listed; },
    async getPurchasableProducts() { return (await loadSnapshot()).purchasable; },
    async getCheckoutProducts() { return (await loadSnapshot()).checkout; },
    async getProductByHandle(slug: string) {
      // Reads `purchasable`, not `listed`: an unlisted colourway's PDP must
      // resolve (it is reachable and fully purchasable by direct URL), while
      // a hidden product — absent from `purchasable` — must 404 here.
      return (await loadSnapshot()).purchasable.find((product) => product.slug === slug) ?? null;
    },
    async getColourwayIndex() { return buildColourwayIndex((await loadSnapshot()).purchasable); },
  };
}

const source = createCatalogSource(getSnapshot);
function getProducts(): Promise<ProductView[]> { return Promise.resolve(source.getProducts()); }
function getPurchasableProducts(): Promise<ProductView[]> { return Promise.resolve(source.getPurchasableProducts()); }
function getCheckoutProducts(): Promise<CheckoutProduct[]> { return Promise.resolve(source.getCheckoutProducts()); }
function getProductByHandle(slug: string): Promise<ProductView | null> { return Promise.resolve(source.getProductByHandle(slug)); }
function getColourwayIndex(): Promise<ColourwayIndex> { return Promise.resolve(source.getColourwayIndex()); }

export { getProducts, getPurchasableProducts, getCheckoutProducts, getProductByHandle, getColourwayIndex, source };
