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
      {
        id: 201,
        combination: ["M", "Negro"],
        price: ORIGINAL_PRICE,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
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
          dispatch({ type: "add", productId: 101, variantId: 201, price: ORIGINAL_PRICE, limit: null })
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

const PROMO_CATALOG: CartCatalog = [
  {
    productId: 102,
    slug: "musculosa-promo",
    title: "Musculosa Promo",
    image: null,
    variants: [
      {
        id: 202,
        combination: ["M"],
        // compareAt (original, higher) 150.000; price (current, lower) 92.000
        // — the worked example from the design and spec.
        price: { amount: 9_200_000, currency: "ARS" },
        compareAt: { amount: 15_000_000, currency: "ARS" },
        inStock: true,
        stockManagement: false,
        stock: null,
      },
    ],
  },
];

/** Seeds one line for the promo variant, then renders `LineRow` for it. */
function PromoHarness() {
  const dispatch = useCartDispatch();
  const state = useCartState();
  const line = state.status === "ready" ? state.lines[0] : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "add",
            productId: 102,
            variantId: 202,
            price: { amount: 9_200_000, currency: "ARS" },
            limit: null,
          })
        }
      >
        seed promo
      </button>
      {line && <LineRow line={line} />}
    </div>
  );
}

function renderPromoHarness() {
  return render(
    <CartProvider catalog={PROMO_CATALOG} transferRateBp={1000} storage={emptyStorage()}>
      <PromoHarness />
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
    // this would render the transfer price of $27.000 and the test would fail.
    // Both figures are TRANSFER prices ($30.000 -> $27.000, $27.000 -> $24.300
    // at the 10% rate this harness configures).
    const drifted: CartCatalog = [
      {
        ...CATALOG[0]!,
        variants: [{ ...CATALOG[0]!.variants[0]!, price: DRIFTED_PRICE }],
      },
    ];

    renderHarness(drifted);
    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    expect(screen.getByText("$27.000")).not.toBeNull();
    expect(screen.queryByText("$24.300")).toBeNull();
  });

  it("shows exactly one transfer price and no badge for a non-promotional line", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "seed" }));

    // $27.000 at 10% transfer is $24.300 — never the raw list price.
    expect(screen.getByText("$24.300")).not.toBeNull();
    expect(screen.queryByText("$27.000")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("shows the struck previous transfer price and the discount badge for a promotional line", () => {
    renderPromoHarness();
    fireEvent.click(screen.getByRole("button", { name: "seed promo" }));

    // compareAt 150.000 / price 92.000 -> current 82.800, previous struck
    // 135.000, badge -39% (worked example, design + spec).
    const struck = screen.getByText("$135.000");
    expect(struck.tagName).toBe("S");
    expect(screen.getByText("$82.800")).not.toBeNull();
    expect(screen.getByText("-39%")).not.toBeNull();
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
