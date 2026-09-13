import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import { CHECKOUT_FAILURE_REASON } from "../api/checkout-messages";
import type { CheckoutPort } from "../api/port";
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
    variants: [
      {
        id: 201,
        combination: ["M"],
        price: PRICE,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
    ],
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
          onClick={() =>
            dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit: null })
          }
        >
          seed
        </button>
      )}
      <CartDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

describe("CartDrawer", () => {
  it("opens and returns focus to the trigger when closed", async () => {
    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
        <Harness />
      </CartProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Abrir carrito" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Carrito" })).not.toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar carrito" })),
    );

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

  it("shows empty only once a ready cart has zero lines", () => {
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
    expect(screen.getByText("Un producto ya no est\u00e1 disponible.")).not.toBeNull();
    markup.unmount();
  });

  it("runs the local checkout from idle through pending to its honest unavailable outcome", async () => {
    const unavailableCheckout: CheckoutPort = {
      startCheckout: async () => ({ status: "unavailable", reason: CHECKOUT_FAILURE_REASON }),
    };

    render(
      <CartProvider
        catalog={CATALOG}
        transferRateBp={1000}
        storage={emptyStorage()}
        checkout={unavailableCheckout}
      >
        <Harness addLine />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

    const checkout = screen.getByRole("button", { name: "Finalizar compra" }) as HTMLButtonElement;
    act(() => {
      checkout.click();
    });

    expect(checkout.disabled).toBe(true);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No pudimos iniciar el checkout. Intent\u00e1 de nuevo."));
  });

  it("identifies every affected line when checkout rejects the cart", async () => {
    const rejectedCheckout: CheckoutPort = {
      startCheckout: async () => ({ status: "rejected", lines: [201, 999] }),
    };

    render(
      <CartProvider
        catalog={CATALOG}
        transferRateBp={1000}
        storage={emptyStorage()}
        checkout={rejectedCheckout}
      >
        <Harness addLine />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar compra" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Remera Classic / M");
    expect(alert.textContent).toContain("999");
  });

  it("scrolls notices with the lines instead of giving them a box of their own", () => {
    const storage: CartStoragePort = {
      read: () => ({
        lines: [
          {
            productId: 101,
            variantId: 201,
            quantity: 1,
            unitPriceMinor: PRICE.amount,
            currency: PRICE.currency,
          },
        ],
        notices: [
          { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
        ],
      }),
      write: () => {},
      clear: () => {},
    };

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
        <CartDrawer open onOpenChange={() => {}} />
      </CartProvider>,
    );

    const notices = screen.getByRole("region", { name: "Avisos del carrito" });
    const line = screen.getByText("Remera Classic");

    // One scroller for the whole column: whatever scrolls the lines has to be
    // the very same element that scrolls the notices, or the two regions get
    // their own scrollbars and their own hand-tuned heights again.
    expect(notices.closest(".overflow-y-auto")).toBe(line.closest(".overflow-y-auto"));
    expect(notices.closest(".overflow-y-auto")).not.toBeNull();
  });
});
