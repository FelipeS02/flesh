import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch, useCartState } from "../state/cart-context";
import { LineRow } from "./line-row";

const ORIGINAL_PRICE = { amount: 2_700_000, currency: "ARS" } as const;
const DRIFTED_PRICE = { amount: 3_000_000, currency: "ARS" } as const;

/** No stored cart, so the provider reaches `ready` with zero lines synchronously. */
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
      { id: 201, combination: ["M", "Negro"], price: ORIGINAL_PRICE, inStock: true },
    ],
  },
];

/** Seeds one line via the real reducer, then renders `LineRow` for it. */
function Harness() {
  const dispatch = useCartDispatch();
  const state = useCartState();
  const line = state.status === "ready" ? state.lines[0] : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 101, variantId: 201, price: ORIGINAL_PRICE })
        }
      >
        seed
      </button>
      {line && <LineRow line={line} />}
    </div>
  );
}

function renderHarness(catalog: CartCatalog = CATALOG) {
  return render(
    <CartProvider catalog={catalog} transferRateBp={1000} storage={emptyStorage()}>
      <Harness />
    </CartProvider>,
  );
}

describe("LineRow", () => {
  it("renders the product's title and combination straight from the live catalog", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    expect(screen.getByText("Remera Classic")).not.toBeNull();
    expect(screen.getByText("M, Negro")).not.toBeNull();
  });

  it("prices the line at the catalog's CURRENT price, never the stored witness", () => {
    // The catalog now sells the variant for a different amount than the price
    // captured on the line at `add` time — the exact drift `reconcile`
    // exists to close before the provider ever holds a stale line. If
    // `LineRow` read `line.price` instead of looking the variant up live,
    // this would render the original $27.000 and the test would fail.
    const drifted: CartCatalog = [
      {
        ...CATALOG[0]!,
        variants: [{ ...CATALOG[0]!.variants[0]!, price: DRIFTED_PRICE }],
      },
    ];

    renderHarness(drifted);
    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    expect(screen.getByText("$30.000")).not.toBeNull();
    expect(screen.queryByText("$27.000")).toBeNull();
  });

  it("renders nothing for a line whose variant is absent from the catalog", () => {
    const line = { productId: 999, variantId: 999, quantity: 1, price: ORIGINAL_PRICE };

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
        <LineRow line={line} />
      </CartProvider>,
    );

    expect(screen.queryByText(/Remera/)).toBeNull();
  });

  // The row is the natural home for the quantity control: a shopper adjusts
  // or removes a line from the same place they read its title and price.
  // Asserting the dispatched effect (not just that a button renders) proves
  // the composed `Stepper` is wired to the real reducer through this row.
  it("composes the quantity stepper, wired to the same line", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));

    expect(screen.getByText("2")).not.toBeNull();
  });
});
