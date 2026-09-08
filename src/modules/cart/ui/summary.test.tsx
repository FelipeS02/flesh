import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch } from "../state/cart-context";
import { CartSummary } from "./summary";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;
const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: "remera-classic",
    title: "Remera Classic",
    image: null,
    variants: [{ id: 201, combination: ["M"], price: PRICE, inStock: true }],
  },
];

function emptyStorage(): CartStoragePort {
  return { read: () => null, write: () => {}, clear: () => {} };
}

function Harness() {
  const dispatch = useCartDispatch();

  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, quantity: 3 })}
      >
        seed
      </button>
      <CartSummary />
    </>
  );
}

describe("CartSummary", () => {
  it("derives subtotal, transfer discount, and total from the shared totals selector", () => {
    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
        <Harness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    expect(screen.getByText("Subtotal")).not.toBeNull();
    expect(screen.getByText("$81.000")).not.toBeNull();
    expect(screen.getByText("Descuento por transferencia")).not.toBeNull();
    expect(screen.getByText("-$8.100")).not.toBeNull();
    expect(screen.getByText("Total")).not.toBeNull();
    expect(screen.getByText("$72.900")).not.toBeNull();
  });
});
