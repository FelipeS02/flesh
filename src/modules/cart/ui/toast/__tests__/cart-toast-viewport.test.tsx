import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../../../api/storage";
import type { CartCatalog } from "../../../domain/catalog-projection";
import type { StoredCart } from "../../../domain/reconcile";
import { setViewport } from "../../../../../../test/fixtures/viewport";
import { CartProvider, useCartDispatch, useCartState } from "../../../state/cart-context";
import { CartToastViewport } from "../cart-toast-viewport";
import { showAddedToCart } from "../manager";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;
const PROMO_PRICE = { amount: 9_200_000, currency: "ARS" } as const;

const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: "remera-classic",
    title: "Remera Classic",
    image: "/products/1.png",
    variants: [
      {
        id: 201,
        sku: null,
        combination: ["M", "Negro"],
        price: PRICE,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
    ],
  },
  {
    productId: 102,
    slug: "musculosa-promo",
    title: "Musculosa Promo",
    image: null,
    variants: [
      {
        id: 202,
        sku: null,
        combination: ["M"],
        // compareAt (original, higher) 150.000; price (current, lower) 92.000
        // — the worked example from the design and spec.
        price: PROMO_PRICE,
        compareAt: { amount: 15_000_000, currency: "ARS" },
        inStock: true,
        stockManagement: false,
        stock: null,
      },
    ],
  },
];

function fakeStorage(onWrite?: (cart: StoredCart) => void): CartStoragePort {
  return {
    read: () => null,
    write: (cart) => onWrite?.(cart),
    clear: () => {},
  };
}

function Harness() {
  const dispatch = useCartDispatch();
  const state = useCartState();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit: null })
        }
      >
        seed
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 102, variantId: 202, price: PROMO_PRICE, limit: null })
        }
      >
        seed promo
      </button>
      {/* The PDP's add control as it really behaves: `data-cart-add`, and one
          handler that dispatches AND fires the toast. Separate from `seed`
          above because only this one is driven with a real `pointerdown`. */}
      <button
        type="button"
        data-cart-add=""
        onClick={() => {
          const repeat =
            state.status === "ready" && state.lines.some((line) => line.variantId === 201);
          dispatch({ type: "add", productId: 101, variantId: 201, price: PRICE, limit: null });
          showAddedToCart({ variantId: 201, repeat });
        }}
      >
        <span>Agregar al carrito</span>
      </button>
      {/* `document.body` stands in for the header's Cart Trigger — any live
          element satisfies `isElement`, which is all the positioner needs. */}
      <CartToastViewport anchor={document.body} />
    </>
  );
}

function renderHarness(storage: CartStoragePort = fakeStorage()) {
  return render(
    <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
      <Harness />
    </CartProvider>,
  );
}

function seed() {
  fireEvent.click(screen.getByRole("button", { name: "seed" }));
}

function seedPromo() {
  fireEvent.click(screen.getByRole("button", { name: "seed promo" }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CartToastViewport", () => {
  // T7
  it("dedupes a re-add onto the same toast, updating its status text and quantity", () => {
    renderHarness();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: false }));

    expect(screen.getByText("AGREGADO AL CARRITO")).not.toBeNull();
    expect(screen.getByText(/1 x/)).not.toBeNull();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: true }));

    expect(
      screen.getAllByText(/AGREGADO AL CARRITO|SUMASTE OTRA UNIDAD/),
    ).toHaveLength(1);
    expect(screen.getByText("SUMASTE OTRA UNIDAD")).not.toBeNull();
    expect(screen.getByText(/2 x/)).not.toBeNull();
  });

  // The dedupe is only an in-place update if the toast's own DOM node
  // SURVIVES the second add. It did not: on mobile the tap's `pointerdown`
  // reached `useDismissOnInteraction` before the click handler ran, so the
  // toast was already `ending` by the time `showAddedToCart` fired, and Base
  // UI's `addToast` tears an ending toast down and builds a fresh one
  // (`store.js:126-130`). A fresh node replays the entrance animation and
  // comes back at `updateKey: 0`, which is also why the two lines that are
  // supposed to announce the change stopped announcing anything.
  it("keeps the same toast element when a real tap adds a second unit on mobile", async () => {
    setViewport("mobile");
    renderHarness();
    const add = screen.getByRole("button", { name: "Agregar al carrito" });

    fireEvent.pointerDown(add);
    fireEvent.click(add);

    const before = document.querySelector('[role="dialog"]');
    expect(before).not.toBeNull();

    // The hook arms its listeners a frame late, so nothing before this point
    // could have dismissed anything regardless.
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    // Targets the label inside the button, the way a finger does.
    fireEvent.pointerDown(add.firstElementChild!);
    fireEvent.click(add);

    expect(document.querySelector('[role="dialog"]')).toBe(before);
    expect(screen.getByText("SUMASTE OTRA UNIDAD")).not.toBeNull();
    expect(screen.getByText(/2 x/)).not.toBeNull();
  });

  // T8
  it("restarts its 5s dismiss timer on re-add", () => {
    vi.useFakeTimers();
    renderHarness();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: false }));
    expect(screen.getByText("AGREGADO AL CARRITO")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("AGREGADO AL CARRITO")).not.toBeNull();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: true }));

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("SUMASTE OTRA UNIDAD")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("SUMASTE OTRA UNIDAD")).toBeNull();
  });

  // T9
  it("renders nothing and throws nothing when fired with no viewport mounted", () => {
    expect(() => showAddedToCart({ variantId: 201, repeat: false })).not.toThrow();
    expect(screen.queryByText("AGREGADO AL CARRITO")).toBeNull();
  });

  // T10
  it("announces politely without moving focus, and keeps the close control in the tab order", () => {
    renderHarness();
    document.body.focus();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: false }));

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(document.activeElement).toBe(document.body);

    // Queried directly rather than through `getByRole`: `Toast.Close` sets
    // `aria-hidden` until it is hovered or focused (Base UI's own
    // collapsed-stack behaviour, `close/ToastClose.js`), which is orthogonal
    // to whether the DOM puts it in the tab order — its `tabindex` is
    // unconditionally `0`, which is the actual fact this test is about.
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]');
    expect(close).not.toBeNull();
    expect(close?.tabIndex).toBe(0);
  });

  // T11
  it("never persists the toast — localStorage writes stay identical before and after", () => {
    const writes: StoredCart[] = [];
    renderHarness(fakeStorage((cart) => writes.push(cart)));

    seed();
    const writesBeforeToast = writes.length;

    act(() => showAddedToCart({ variantId: 201, repeat: false }));

    expect(writes.length).toBe(writesBeforeToast);
    expect(writes.at(-1)).toEqual(writes[writesBeforeToast - 1]);
  });

  // The promo branch of `AddedToast` — the spec's "First add, promotional
  // garment" scenario — reaching the TOAST specifically. `promoPriceView` is
  // proven as a pure function and `LineRow` is proven in the drawer, but
  // neither exercises this component's own `price.previous` / `price.percent`
  // rendering: until this test existed, every catalog fixture here carried
  // `compareAt: null`, so the struck price and the badge were written and
  // never run. Half of what this change exists to show, unproven.
  it("shows the struck previous transfer price and the discount badge for a promotional garment", () => {
    renderHarness();

    seedPromo();
    act(() => showAddedToCart({ variantId: 202, repeat: false }));

    // compareAt 150.000 / price 92.000 -> current 82.800, previous struck
    // 135.000, badge -39% (worked example, design + spec). Asserting the
    // rendered figures rather than a call to `promoPriceView` is what makes
    // this fail if the two prices are ever swapped: the badge is computed
    // from the RAW pair, so an inverted pair yields no badge at all.
    const struck = screen.getByText("$135.000");
    expect(struck.tagName).toBe("S");
    expect(screen.getByText(/1 x \$82\.800/)).not.toBeNull();
    expect(screen.getByText("-39%")).not.toBeNull();
  });

  it("shows a single price and no badge for a garment that is not on promotion", () => {
    renderHarness();

    seed();
    act(() => showAddedToCart({ variantId: 201, repeat: false }));

    // $27.000 at 10% transfer is $24.300 — never the raw list price.
    expect(screen.getByText(/1 x \$24\.300/)).not.toBeNull();
    expect(screen.queryByText("$27.000")).toBeNull();
    expect(document.querySelector("s")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
