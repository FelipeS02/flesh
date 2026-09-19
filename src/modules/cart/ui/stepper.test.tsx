import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import { CartProvider, useCartDispatch, useCartState } from "../state/cart-context";
import { Stepper } from "./stepper";

const analyticsSpy = vi.hoisted(() => vi.fn());
vi.mock("@/modules/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/analytics")>();
  return { ...actual, dispatchAnalyticsEvent: analyticsSpy };
});

afterEach(() => analyticsSpy.mockClear());

const PRICE = { amount: 1_000_000, currency: "ARS" } as const;
const ANALYTICS_ITEM = {
  item_id: "TEE-M",
  item_name: "Remera Classic",
  price: 10000,
  quantity: 1,
  currency: "ARS",
} as const;

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
        sku: "TEE-M",
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

/** Seeds one line at quantity 1 via the real reducer, then renders `Stepper` for it. */
function Harness({ limit = null }: { limit?: number | null } = {}) {
  const dispatch = useCartDispatch();
  const state = useCartState();
  const line = state.status === "ready" ? state.lines[0] : undefined;
  const lineCount = state.status === "ready" ? state.lines.length : -1;

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit })
        }
      >
        seed
      </button>
      {line && (
        <Stepper line={line} limit={limit} analyticsItem={ANALYTICS_ITEM} />
      )}
      <p data-testid="quantity">{line?.quantity ?? "none"}</p>
      <p data-testid="line-count">{lineCount}</p>
    </div>
  );
}

function renderHarness(limit: number | null = null) {
  return render(
    <CartProvider catalog={CATALOG} transferRateBp={1000} storage={emptyStorage()}>
      <Harness limit={limit} />
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
    expect(analyticsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "add_to_cart" }),
    );
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
    expect(analyticsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "remove_from_cart" }),
    );
  });

  // QUITAR moved out of this component when the drawer was laid out to the
  // artboard — it belongs to the title row, the stepper to the bottom row.
  // Its behaviour is proven in `remove-line-button.test.tsx`; what this file
  // asserts here is that the stepper no longer offers it, so a future edit
  // cannot quietly put a second remove control back inside the quantity
  // group where the artboard has none.
  it("offers no remove control of its own", () => {
    renderHarness();
    seed();

    expect(screen.queryByRole("button", { name: "QUITAR" })).toBeNull();
  });
});

/**
 * The reducer owns the clamp (`reducer.test.ts`'s "purchase limit" describe);
 * `disabled` here is affordance only — it must never be the only thing
 * stopping the quantity from growing past what the merchant has in stock.
 */
describe("Stepper — purchase limit affordance", () => {
  it("disables Sumar once the line is at the limit", () => {
    renderHarness(1);
    seed();

    expect(screen.getByRole("button", { name: "Sumar" }).hasAttribute("disabled")).toBe(true);
  });

  it("leaves Sumar enabled below the limit", () => {
    renderHarness(2);
    seed();

    expect(screen.getByRole("button", { name: "Sumar" }).hasAttribute("disabled")).toBe(false);
  });

  it("never disables Sumar when the limit is null (untracked stock)", () => {
    renderHarness(null);
    seed();

    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));

    expect(screen.getByRole("button", { name: "Sumar" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("quantity").textContent).toBe("3");
  });

  it("passes the limit on the increment it dispatches, so a stale limit cannot be worked around by clicking through a race", () => {
    renderHarness(2);
    seed();

    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sumar" }));

    expect(screen.getByTestId("quantity").textContent).toBe("2");
  });
});
