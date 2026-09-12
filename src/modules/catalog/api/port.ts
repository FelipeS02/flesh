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
  getCheckoutProducts(): Promise<CheckoutProduct[]> | CheckoutProduct[];
  getProductByHandle(slug: string): Promise<ProductView | null> | ProductView | null;
  getColourwayIndex(): Promise<ColourwayIndex> | ColourwayIndex;
}
