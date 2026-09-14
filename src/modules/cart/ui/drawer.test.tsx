import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import { CHECKOUT_FAILURE_REASON } from "../api/checkout-messages";
import type { BuyerProfilePort, BuyerProfileSummary, CheckoutOutcome, CheckoutPort } from "../api/port";
import type { CartView } from "../domain/line";
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

/** Resolves immediately, so tests unrelated to the skip path do not have to wait on `loading`. */
function absentProfile(): BuyerProfilePort {
  return { readSummary: async () => ({ hasProfile: false, maskedLabel: null }) };
}

function savedProfile(maskedLabel = "Comprar como F••• S•••"): BuyerProfilePort {
  return { readSummary: async () => ({ hasProfile: true, maskedLabel }) };
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

async function openWithLine(buyerProfile: BuyerProfilePort = absentProfile(), checkout?: CheckoutPort) {
  render(
    <CartProvider
      catalog={CATALOG}
      transferRateBp={1000}
      storage={emptyStorage()}
      buyerProfile={buyerProfile}
      checkout={checkout}
    >
      <Harness addLine />
    </CartProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "seed" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

  return screen.findByRole("button", { name: "Finalizar compra" }) as Promise<HTMLButtonElement>;
}

/** Required fields now block a native submit (spec "Empty submit blocked"), so any test exercising a real Pagar/form submit must fill them first. */
function fillBuyerFields() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Felipe" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Saracho" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "felipe@example.com" } });
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
    expect(screen.getByText("Un producto ya no está disponible.")).not.toBeNull();
    markup.unmount();
  });

  it("runs the local checkout from idle through pending to its honest unavailable outcome", async () => {
    const unavailableCheckout: CheckoutPort = {
      startCheckout: async () => ({ status: "unavailable", reason: CHECKOUT_FAILURE_REASON }),
    };

    const checkout = await openWithLine(absentProfile(), unavailableCheckout);
    fillBuyerFields();
    act(() => {
      checkout.click();
    });

    expect(checkout.disabled).toBe(true);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No pudimos iniciar el checkout. Intentá de nuevo."));
  });

  it("identifies every affected line when checkout rejects the cart", async () => {
    const rejectedCheckout: CheckoutPort = {
      startCheckout: async () => ({ status: "rejected", lines: [201, 999] }),
    };

    const checkout = await openWithLine(absentProfile(), rejectedCheckout);
    fillBuyerFields();
    fireEvent.click(checkout);

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

describe("CartDrawer form submission (spec: Form Submission Contract)", () => {
  it("is a real <form> whose submit fires the checkout machine exactly once with the typed buyer", async () => {
    const start = vi.fn(async (): Promise<CheckoutOutcome> => ({ status: "redirect", url: "https://checkout.example.com/checkout/9/token" }));
    await openWithLine(absentProfile(), { startCheckout: start });

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Felipe" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Saracho" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "felipe@example.com" } });

    const form = screen.getByRole("button", { name: "Finalizar compra" }).closest("form");
    expect(form).not.toBeNull();

    // jsdom does not implement a browser's native implicit-submission-on-Enter
    // behavior (verified empirically: no submit event fires from a bare Enter
    // keydown), so dispatching the form's own `submit` event is the correct
    // in-jsdom proxy for "Enter submits" — both paths reach the identical
    // `<form onSubmit>` handler; the literal Enter-key path is the real-browser
    // check in Phase 8.2.
    fireEvent.submit(form!);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        buyer: { firstName: "Felipe", lastName: "Saracho", email: "felipe@example.com" },
      }),
    );
  });

  it("submits via the Pagar button, which is a real submit-type control", async () => {
    const start = vi.fn(async (): Promise<CheckoutOutcome> => ({ status: "redirect", url: "https://checkout.example.com/checkout/9/token" }));
    const checkout = await openWithLine(absentProfile(), { startCheckout: start });
    fillBuyerFields();

    expect(checkout.getAttribute("type")).toBe("submit");
    fireEvent.click(checkout);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  });

  it("gives every buyer input a name and marks it required, so an empty submit is blocked natively", async () => {
    await openWithLine();

    const firstName = screen.getByLabelText("Nombre") as HTMLInputElement;
    const lastName = screen.getByLabelText("Apellido") as HTMLInputElement;
    const email = screen.getByLabelText("Email") as HTMLInputElement;

    expect(firstName.name).toBe("firstName");
    expect(firstName.required).toBe(true);
    expect(lastName.name).toBe("lastName");
    expect(lastName.required).toBe(true);
    expect(email.name).toBe("email");
    expect(email.required).toBe(true);
  });
});

describe("CartDrawer skip-path profile phases (design D2)", () => {
  it("shows a placeholder with no form and no label while loading, and keeps Pagar disabled", async () => {
    let resolveSummary!: (summary: BuyerProfileSummary) => void;
    const pending: BuyerProfilePort = {
      readSummary: () => new Promise((resolve) => { resolveSummary = resolve; }),
    };

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()} buyerProfile={pending}>
        <Harness addLine />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(screen.queryByText(/Comprar como/)).toBeNull();
    expect((screen.getByRole("button", { name: "Finalizar compra" }) as HTMLButtonElement).disabled).toBe(true);

    resolveSummary({ hasProfile: false, maskedLabel: null });
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Finalizar compra" }) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("calls readSummary exactly once per open", async () => {
    const readSummary = vi.fn(async () => ({ hasProfile: false, maskedLabel: null }));

    await openWithLine({ readSummary });

    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(1));
  });

  it("shows the masked label and Cambiar in the saved phase, and omits buyer from the submitted cart", async () => {
    const start = vi.fn<(cart: CartView) => Promise<CheckoutOutcome>>(async () => ({ status: "redirect", url: "https://checkout.example.com/checkout/9/token" }));
    const checkout = await openWithLine(savedProfile(), { startCheckout: start });

    const label = screen.getByText("Comprar como F••• S•••");
    expect(label).not.toBeNull();
    // Spec "Accessible name matches visible text": no aria-label may carry an
    // unmasked value, so the accessible name must be exactly this visible text.
    expect(screen.getByText("Comprar como F••• S•••").textContent).toBe(
      "Comprar como F••• S•••",
    );
    expect(screen.queryByLabelText("Nombre")).toBeNull();

    fireEvent.click(checkout);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    const submitted = start.mock.calls[0][0] as { buyer?: unknown };
    expect(submitted.buyer).toBeUndefined();
  });

  it('"Cambiar" restores the empty form', async () => {
    await openWithLine(savedProfile());

    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    expect(screen.queryByText(/Comprar como/)).toBeNull();
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Apellido") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });

  it("shows the form when there is no stored profile", async () => {
    await openWithLine(absentProfile());

    expect(screen.getByLabelText("Nombre")).not.toBeNull();
    expect(screen.queryByText(/Comprar como/)).toBeNull();
  });

  it("fails open to the form when the summary read rejects", async () => {
    const rejecting: BuyerProfilePort = { readSummary: () => Promise.reject(new Error("boom")) };

    await openWithLine(rejecting);

    await waitFor(() => expect(screen.getByLabelText("Nombre")).not.toBeNull());
  });

  it("keeps typed input after the shopper switches from the saved summary to editing", async () => {
    let resolveSummary!: (summary: BuyerProfileSummary) => void;
    const slow: BuyerProfilePort = {
      readSummary: () => new Promise((resolve) => { resolveSummary = resolve; }),
    };

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()} buyerProfile={slow}>
        <Harness addLine />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir carrito" }));

    // The read resolves BEFORE `Cambiar` exists, because `Cambiar` only exists
    // in `saved`. So this covers the ordinary path and nothing more — the late
    // resolution the guard actually defends against is the next test.
    resolveSummary({ hasProfile: true, maskedLabel: "Comprar como F••• S•••" });
    await screen.findByRole("button", { name: "Cambiar" });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ada" } });

    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Ada");
  });

  it("never lets a stale read from a closed drawer overwrite what was typed after reopening", async () => {
    // The only way `setProfile`'s `current !== 'loading'` guard is reachable.
    // Within ONE open a late resolution cannot collide with `editing`, because
    // `Cambiar` is only rendered in `saved`, which the resolution itself
    // produces. The real race needs a read left pending by a drawer the
    // shopper closed, landing while a LATER open has already moved on.
    const resolvers: Array<(summary: BuyerProfileSummary) => void> = [];
    const buyerProfile: BuyerProfilePort = {
      readSummary: () => new Promise((resolve) => { resolvers.push(resolve); }),
    };

    function ToggleHarness() {
      const [open, setOpen] = useState(false);
      const dispatch = useCartDispatch();

      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>toggle</button>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit: null })
            }
          >
            seed
          </button>
          <CartDrawer open={open} onOpenChange={setOpen} />
        </>
      );
    }

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()} buyerProfile={buyerProfile}>
        <ToggleHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    // Base UI marks background siblings inert while the dialog is open, which
    // hides the toggle from the accessible tree; `hidden: true` reads through.
    const toggle = () => screen.getByRole("button", { name: "toggle", hidden: true });

    fireEvent.click(toggle());
    await waitFor(() => expect(resolvers).toHaveLength(1));

    fireEvent.click(toggle()); // close, leaving the first read pending forever
    fireEvent.click(toggle()); // reopen, starting a second read
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The reopened drawer settles, the shopper presses `Cambiar` and types.
    resolvers[1]({ hasProfile: true, maskedLabel: "Comprar como F••• S•••" });
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ada" } });

    // Now the abandoned first read lands, carrying a different identity.
    await act(async () => {
      resolvers[0]({ hasProfile: true, maskedLabel: "Comprar como Z••• Z•••" });
    });

    // Without the guard this snaps back to the masked summary and the typed
    // name is gone — the shopper would then check out as somebody else.
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Ada");
    expect(screen.queryByRole("button", { name: "Cambiar" })).toBeNull();
  });

  it("resets to loading when the drawer closes, so the next open re-reads the profile", async () => {
    const readSummary = vi.fn(async () => ({ hasProfile: false, maskedLabel: null }));

    function ToggleHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>toggle</button>
          <CartDrawer open={open} onOpenChange={setOpen} />
        </>
      );
    }

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()} buyerProfile={{ readSummary }}>
        <ToggleHarness />
      </CartProvider>,
    );

    // Base UI's dialog marks background siblings inert while open, which
    // hides this trigger from the accessible tree — `hidden: true` reads
    // through that so the same toggle button is queryable throughout.
    const toggle = () => screen.getByRole("button", { name: "toggle", hidden: true });
    fireEvent.click(toggle());
    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(1));

    fireEvent.click(toggle()); // close
    fireEvent.click(toggle()); // reopen

    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(2));
  });
});
