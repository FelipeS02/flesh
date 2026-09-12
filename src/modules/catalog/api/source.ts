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
    async getCheckoutProducts() { return (await loadSnapshot()).checkout; },
    async getProductByHandle(slug: string) {
      return (await loadSnapshot()).all.find((product) => product.slug === slug) ?? null;
    },
    async getColourwayIndex() { return buildColourwayIndex((await loadSnapshot()).all); },
  };
}

const source = createCatalogSource(getSnapshot);
function getProducts(): Promise<ProductView[]> { return Promise.resolve(source.getProducts()); }
function getCheckoutProducts(): Promise<CheckoutProduct[]> { return Promise.resolve(source.getCheckoutProducts()); }
function getProductByHandle(slug: string): Promise<ProductView | null> { return Promise.resolve(source.getProductByHandle(slug)); }
function getColourwayIndex(): Promise<ColourwayIndex> { return Promise.resolve(source.getColourwayIndex()); }

export { getProducts, getCheckoutProducts, getProductByHandle, getColourwayIndex, source };
