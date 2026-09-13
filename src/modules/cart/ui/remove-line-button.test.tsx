import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch, useCartState } from "../state/cart-context";
import { RemoveLineButton } from "./remove-line-button";

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

/** Seeds one line via the real reducer, then renders the button for it. */
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
          dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit: null })
        }
      >
        seed
      </button>
      {line && <RemoveLineButton line={line} />}
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

describe("RemoveLineButton", () => {
  // The load-bearing case, moved here from `stepper.test.tsx` when the
  // control was split out to its own component. It must dispatch the
  // explicit remove, not merely decrement toward zero. Seeded to quantity 2
  // first, because that is the only setup that tells the two apart: a
  // decrement-based implementation would leave a line at quantity 1 here,
  // while at quantity 1 both actions would look identical.
  it("dispatches the explicit remove, not a decrement", () => {
    renderHarness();
    seed();
    seed();

    expect(screen.getByTestId("quantity").textContent).toBe("2");

    // Queried by accessible name, not by test id: the control is icon-only,
    // so `aria-label` is the ONLY name a shopper on a screen reader ever
    // hears. Reaching past it would let that label be dropped without a
    // single test noticing — on the one control in the drawer that discards.
    fireEvent.click(screen.getByRole("button", { name: "Eliminar producto del carrito" }));

    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });
});
