import { describe, expect, it } from "vitest";
import { useLayoutEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartCatalog } from "@/modules/cart/domain/catalog-projection";
import { CartProvider, useCartDispatch } from "@/modules/cart";
import { Header } from "./header";

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

function SeedCart({ quantity }: { quantity: number }) {
  const dispatch = useCartDispatch();

  useLayoutEffect(() => {
    if (quantity > 0) {
      dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, quantity });
    }
  }, [dispatch, quantity]);

  return null;
}

function renderHeader(quantity = 0) {
  return render(
    <CartProvider catalog={CATALOG} transferRateBp={1000}>
      <SeedCart quantity={quantity} />
      <Header />
    </CartProvider>,
  );
}

describe("Header", () => {
  it("renders a link to the homepage wrapping the wordmark", () => {
    renderHeader();

    const link = screen.getByRole("link", { name: /flesh/i });

    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders the FLESH wordmark svg inside that link", () => {
    renderHeader();

    const link = screen.getByRole("link", { name: /flesh/i });
    const svg = link.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 575 229");
  });

  it("keeps the wordmark in the middle column and reserves the third for the cart trigger", () => {
    const { container } = renderHeader();

    const header = container.querySelector("header");
    const link = screen.getByRole("link", { name: /flesh/i });

    expect(header?.children).toHaveLength(2);
    expect(header?.firstElementChild).toBe(link);
    expect(screen.getByRole("button", { name: "Abrir carrito" })).not.toBeNull();
  });

  it("shows the ready item count and opens the cart drawer from its trigger", () => {
    renderHeader(2);

    expect(screen.getByText("2")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

    expect(screen.getByRole("dialog", { name: "Carrito" })).not.toBeNull();
  });

  it("renders no count while the cart is hydrating", () => {
    const markup = renderToStaticMarkup(
      <CartProvider catalog={CATALOG} transferRateBp={1000}>
        <Header />
      </CartProvider>,
    );

    expect(markup).not.toContain("aria-label=\"0 productos en el carrito\"");
    expect(markup).not.toContain("aria-label=\"2 productos en el carrito\"");
  });
});
