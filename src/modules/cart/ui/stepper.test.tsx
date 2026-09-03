import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch, useCartState } from "../state/cart-context";
import { Stepper } from "./stepper";

const PRICE = { amount: 1_000_000, currency: "ARS" } as const;

function emptyStorage(): CartStoragePort {
  return { read: () => null, write: () => {}, clear: () => {} };
}

const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: "remera-classic",
    title: "Remera Classic",
    image: null,
    variants: [{ id: 201, combination: ["M"], price: PRICE, inStock: true }],
  },
];

/** Seeds one line at quantity 1 via the real reducer, then renders `Stepper` for it. */
function Harness() {
  const dispatch = useCartDispatch();
  const state = useCartState();
  const line = state.status === "ready" ? state.lines[0] : undefined;
  const lineCount = state.status === "ready" ? state.lines.length : -1;

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE })
        }
      >
        seed
      </button>
      {line && <Stepper line={line} />}
      <p data-testid="quantity">{line?.quantity ?? "none"}</p>
      <p data-testid="line-count">{lineCount}</p>
    </div>
  );
}

function renderHarness() {
  return render(
    <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
      <Harness />
    </CartProvider>,
  );
}

function seed() {
  fireEvent.click(screen.getByRole("button", { name: "seed" }));
}

describe("Stepper", () => {
  it("increments the line's quantity through the shared reducer", () => {
    renderHarness();
    seed();

    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));

    expect(screen.getByTestId("quantity").textContent).toBe("2");
  });

  // "Decrement at quantity 1 removes the line (do not clamp at 1)" — the
  // stepper must dispatch the same "decrement" unconditionally and let the
  // reducer's own remove-at-zero rule do the work (already proven in
  // `reducer.test.ts`), never guard the click at quantity 1.
  it("removes the line on decrement at quantity 1, instead of clamping", () => {
    renderHarness();
    seed();

    fireEvent.click(screen.getByRole("button", { name: "Restar" }));

    expect(screen.getByTestId("line-count").textContent).toBe("0");
    expect(screen.getByTestId("quantity").textContent).toBe("none");
  });

  // QUITAR must dispatch the explicit remove action, not merely decrement
  // down to zero. Seeded to quantity 2 first so a decrement-based
  // implementation would leave a line at quantity 1 instead of removing it —
  // the only setup that actually distinguishes the two actions.
  it("QUITAR dispatches the explicit remove, not a decrement", () => {
    renderHarness();
    seed();
    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));

    fireEvent.click(screen.getByRole("button", { name: "QUITAR" }));

    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });
});
