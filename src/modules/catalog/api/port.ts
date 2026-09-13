import type { ColourwayIndex } from "../domain/colourway";
import type { Money } from "../domain/product";
import type { ProductView } from "../domain/product";

export type CheckoutVariant = {
  productId: number;
  variantId: number;
  price: Money;
  stockManagement: boolean;
  stock: number | null;
};

export type CheckoutProduct = {
  productId: number;
  variants: CheckoutVariant[];
};

export interface CatalogPort {
  getProducts(): Promise<ProductView[]> | ProductView[];
  // Every non-hidden product (visible + unlisted) — what a shopper can
  // legitimately have in their cart. The client cart catalog is built from
  // THIS, not from `getProducts()`, because an unlisted colourway is fully
  // purchasable from its own PDP but absent from the visible-only listing.
  getPurchasableProducts(): Promise<ProductView[]> | ProductView[];
  getCheckoutProducts(): Promise<CheckoutProduct[]> | CheckoutProduct[];
  getProductByHandle(slug: string): Promise<ProductView | null> | ProductView | null;
  getColourwayIndex(): Promise<ColourwayIndex> | ColourwayIndex;
}
