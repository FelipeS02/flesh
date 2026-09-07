import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch } from "../state/cart-context";
import { CartDrawer } from "./drawer";

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

function Harness({ addLine = false }: { addLine?: boolean }) {
  const [open, setOpen] = useState(false);
  const dispatch = useCartDispatch();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir carrito
      </button>
      {addLine && (
        <button
          type="button"
          onClick={() => dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE })}
        >
          seed
        </button>
      )}
      <CartDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

describe("CartDrawer", () => {
  it("opens, moves focus to its close control, and returns focus to the trigger when closed", async () => {
    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
        <Harness />
      </CartProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Abrir carrito" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Carrito" })).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar carrito" }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("composes live line rows and the summary when the ready cart has lines", () => {
    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
        <Harness addLine />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

    expect(screen.getByText("Remera Classic")).not.toBeNull();
    expect(screen.getByText("Subtotal")).not.toBeNull();
    expect(screen.queryByText("Tu carrito esta vacio")).toBeNull();
  });

  it("shows loading while hydrating and only shows empty once ready with zero lines", () => {
    const serverMarkup = renderToStaticMarkup(
      <CartProvider catalog={CATALOG} transferRateBp={1000}>
        <CartDrawer open onOpenChange={() => {}} />
      </CartProvider>,
    );

    expect(serverMarkup).toContain("Cargando carrito…");
    expect(serverMarkup).not.toContain("Tu carrito esta vacio");

    const storage: CartStoragePort = {
      read: () => ({
        lines: [],
        notices: [
          { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
        ],
      }),
      write: () => {},
      clear: () => {},
    };
    const markup = render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
        <CartDrawer open onOpenChange={() => {}} />
      </CartProvider>,
    );

    // RTL runs effects before this assertion, so the ready branch is the real
    // client outcome. The dedicated server-render assertion below catches the
    // hydrating branch without pretending jsdom can pause effects.
    expect(screen.getByText("Tu carrito esta vacio")).not.toBeNull();
    expect(screen.getByText("Un producto ya no está disponible.")).not.toBeNull();
    markup.unmount();
  });
});
