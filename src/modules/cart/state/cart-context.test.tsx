import { beforeEach, describe, expect, it } from "vitest";
import { useLayoutEffect, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { CHECKOUT_UNAVAILABLE_REASON } from "../api/checkout.local";
import type { CheckoutPort } from "../api/port";
import { CART_STORAGE_KEY, createCartStorage, type CartStoragePort } from "../api/storage";
import type { CartCatalog } from "../domain/catalog-projection";
import type { StoredCart } from "../domain/reconcile";
import {
  CartProvider,
  useCartDispatch,
  useCartEnvironment,
  useCartState,
} from "./cart-context";

const CATALOG_PRICE_201 = { amount: 2_700_000, currency: "ARS" } as const;
const CATALOG_PRICE_202 = { amount: 3_100_000, currency: "ARS" } as const;
const TRANSFER_RATE_BP = 1000;

/**
 * Variant 203 is out of stock and 201 is priced at 2.700.000 — both matter:
 * the stored carts below deliberately disagree with this catalog so that
 * rehydration has real drift to reconcile rather than a happy path to wave
 * through.
 */
const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: "remera-classic",
    title: "Remera Classic",
    image: null,
    variants: [
      { id: 201, combination: ["M"], price: CATALOG_PRICE_201, inStock: true },
      { id: 202, combination: ["L"], price: CATALOG_PRICE_202, inStock: true },
      { id: 203, combination: ["XL"], price: CATALOG_PRICE_201, inStock: false },
    ],
  },
];

/**
 * A storage port whose writes are recorded IN ORDER, because the order is the
 * behaviour under test: the first write must never be the empty initial state
 * landing on top of a stored cart.
 */
function recordingStorage(initial: StoredCart | null = null) {
  const writes: StoredCart[] = [];
  let record = initial;

  const port: CartStoragePort = {
    read: () => record,
    write: (cart) => {
      writes.push(cart);
      record = cart;
    },
    clear: () => {
      record = null;
    },
  };

  return { port, writes, record: () => record };
}

/** Renders the state as text, so every assertion below reads real output. */
function Probe() {
  const state = useCartState();

  if (state.status === "hydrating") {
    return <p data-testid="hydrating">cargando</p>;
  }

  return (
    <div>
      <ul data-testid="lines">
        {state.lines.map((line) => (
          <li key={line.variantId}>{`${line.variantId} x${line.quantity} @${line.price.amount}`}</li>
        ))}
      </ul>
      <ul data-testid="notices">
        {state.notices.map((notice) => (
          <li key={notice.variantId}>{`${notice.kind}:${notice.variantId}`}</li>
        ))}
      </ul>
    </div>
  );
}

function Controls() {
  const dispatch = useCartDispatch();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "add", productId: 101, variantId: 202, price: CATALOG_PRICE_202 })
        }
      >
        agregar
      </button>
      <button type="button" onClick={() => dispatch({ type: "dismissNotice", variantId: 203 })}>
        descartar
      </button>
    </>
  );
}

/**
 * Dispatches during the LAYOUT phase, which React runs before the provider's
 * passive mount effect — a deterministic stand-in for a click that lands
 * between mount and the read, with no timers and no luck involved.
 */
function MidFlightAdd({ statusAtClick }: { statusAtClick: string[] }) {
  const dispatch = useCartDispatch();
  const state = useCartState();

  useLayoutEffect(() => {
    // Recorded, not assumed. Both orderings would produce the same final
    // quantity if the add merely landed late, so the test needs proof that the
    // cart was still hydrating when this dispatch went out — otherwise it
    // would be green without the merge path ever running.
    statusAtClick.push(state.status);
    dispatch({ type: "add", productId: 101, variantId: 201, price: CATALOG_PRICE_201 });
    // Fires once, at the moment before the provider's own mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function mount(storage: CartStoragePort, children: ReactNode = <Probe />, checkout?: CheckoutPort) {
  return render(
    <CartProvider
      catalog={CATALOG}
      transferRateBp={TRANSFER_RATE_BP}
      storage={storage}
      checkout={checkout}
    >
      {children}
    </CartProvider>,
  );
}

function lineTexts() {
  return Array.from(screen.getByTestId("lines").children).map((node) => node.textContent);
}

function noticeTexts() {
  return Array.from(screen.getByTestId("notices").children).map((node) => node.textContent);
}

beforeEach(() => {
  window.localStorage.clear();
});

const STORED_201: StoredCart = {
  lines: [
    { productId: 101, variantId: 201, quantity: 2, unitPriceMinor: 2_700_000, currency: "ARS" },
  ],
  notices: [],
};

describe("hydration", () => {
  // The server cannot read `localStorage` either, so this is simultaneously
  // the first-paint assertion and the reason the server's HTML and the
  // client's first render agree.
  it("renders as hydrating before any effect runs, exactly as the server does", () => {
    const markup = renderToStaticMarkup(
      <CartProvider catalog={CATALOG} transferRateBp={TRANSFER_RATE_BP}>
        <Probe />
      </CartProvider>,
    );

    expect(markup).toContain("cargando");
    expect(markup).not.toContain("data-testid=\"lines\"");
  });

  it("is ready with the stored lines once the mount effect has read storage", () => {
    mount(recordingStorage(STORED_201).port);

    expect(screen.queryByTestId("hydrating")).toBeNull();
    expect(lineTexts()).toEqual(["201 x2 @2700000"]);
  });

  // Without this the provider would never leave `hydrating` and every surface
  // would wait forever on a cart that was never there.
  it("is ready and empty when storage holds nothing at all", () => {
    mount(recordingStorage(null).port);

    expect(screen.queryByTestId("hydrating")).toBeNull();
    expect(lineTexts()).toEqual([]);
  });

  it("drops a line whose variant is now out of stock and says so", () => {
    const stored: StoredCart = {
      lines: [
        { productId: 101, variantId: 203, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" },
      ],
      notices: [],
    };

    mount(recordingStorage(stored).port);

    expect(lineTexts()).toEqual([]);
    expect(noticeTexts()).toEqual(["removed:203"]);
  });

  it("adopts the catalog's price when the stored one has drifted, and says so", () => {
    const stored: StoredCart = {
      lines: [
        { productId: 101, variantId: 202, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" },
      ],
      notices: [],
    };

    mount(recordingStorage(stored).port);

    expect(lineTexts()).toEqual(["202 x1 @3100000"]);
    expect(noticeTexts()).toEqual(["repriced:202"]);
  });

  // Design D4, ordering hazard 3: `rehydrate` merges, it does not replace.
  it("merges a click that landed before storage was read", () => {
    const statusAtClick: string[] = [];

    mount(
      recordingStorage(STORED_201).port,
      <>
        <MidFlightAdd statusAtClick={statusAtClick} />
        <Probe />
      </>,
    );

    // The add really did land in the gap, so what follows exercises the merge.
    expect(statusAtClick).toEqual(["hydrating"]);
    // 2 stored + 1 clicked, in one line — not 2 (the click clobbered) and not
    // 1 (the stored cart lost to an add that arrived first).
    expect(lineTexts()).toEqual(["201 x3 @2700000"]);
  });
});

describe("the write effect", () => {
  it("never lands the empty initial state on top of a stored cart", () => {
    const storage = recordingStorage(STORED_201);

    mount(storage.port);

    // The classic localStorage-provider bug is `writes[0]` being an empty
    // cart, written before anything was ever read. What must be there instead
    // is the reconciled cart.
    expect(storage.writes[0]).toEqual(STORED_201);
  });

  it("writes a line as a price witness, never as Money", () => {
    const storage = recordingStorage(null);
    mount(storage.port, <Controls />);

    fireEvent.click(screen.getByText("agregar"));

    expect(storage.record()).toEqual({
      lines: [
        {
          productId: 101,
          variantId: 202,
          quantity: 1,
          unitPriceMinor: 3_100_000,
          currency: "ARS",
        },
      ],
      notices: [],
    });
  });

  it("flattens a repriced notice into minor units on the way out", () => {
    const storage = recordingStorage({
      lines: [
        { productId: 101, variantId: 202, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" },
      ],
      notices: [],
    });

    mount(storage.port);

    expect(storage.record()?.notices).toEqual([
      {
        kind: "repriced",
        variantId: 202,
        item: "Remera Classic / L",
        fromMinor: 2_700_000,
        toMinor: 3_100_000,
        currency: "ARS",
      },
    ]);
  });

  // Design D3/D4: dismissal is a write-through. Dropping the notice from React
  // state alone would resurrect it on the next reload.
  //
  // This one runs against the REAL adapter over jsdom's `localStorage` rather
  // than the recording stub, because the behaviour spans both units: the
  // provider has to write the smaller notice list, and the adapter has to
  // delete a record with nothing left to remember. A stub reproducing the
  // second half would be asserting against a copy of the rule instead of the
  // rule.
  it("persists a dismissal, so the notice does not come back", () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        lines: [],
        notices: [
          { kind: "removed", reason: "out-of-stock", variantId: 203, item: "Remera Classic / XL" },
        ],
      }),
    );

    mount(createCartStorage(window.localStorage), <Controls />);
    expect(createCartStorage(window.localStorage).read()?.notices).toHaveLength(1);

    fireEvent.click(screen.getByText("descartar"));

    // A "reload" here is a brand-new adapter over the same backing store, the
    // only part of a reload this harness can honestly reproduce.
    expect(createCartStorage(window.localStorage).read()).toBeNull();
  });
});

describe("the provider's environment", () => {
  it("hands down the catalog and rate it was given", () => {
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
        >
          {children}
        </CartProvider>
      ),
    });

    expect(result.current.transferRateBp).toBe(TRANSFER_RATE_BP);
    expect(result.current.catalog).toEqual(CATALOG);
  });

  it("builds a checkout port over that same catalog when none is injected", async () => {
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
        >
          {children}
        </CartProvider>
      ),
    });

    const outcome = await result.current.checkout.startCheckout({ lines: [] });

    expect(outcome).toEqual({ status: "unavailable", reason: CHECKOUT_UNAVAILABLE_REASON });
  });

  it("uses an injected port instead, which is what makes pending testable", async () => {
    const injected: CheckoutPort = {
      startCheckout: async () => ({ status: "redirect", url: "https://example.test/checkout" }),
    };
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
          checkout={injected}
        >
          {children}
        </CartProvider>
      ),
    });

    expect(await result.current.checkout.startCheckout({ lines: [] })).toEqual({
      status: "redirect",
      url: "https://example.test/checkout",
    });
  });
});

/**
 * A hook reaching a missing provider must say so, rather than handing back a
 * default that silently behaves like an empty cart — which is the same lie the
 * hydration union exists to forbid, arriving through a different door.
 */
describe("used outside the provider", () => {
  it("refuses to read state", () => {
    expect(() => renderHook(() => useCartState())).toThrow(/CartProvider/);
  });

  it("refuses to hand out a dispatch", () => {
    expect(() => renderHook(() => useCartDispatch())).toThrow(/CartProvider/);
  });

  it("refuses to hand out the environment", () => {
    expect(() => renderHook(() => useCartEnvironment())).toThrow(/CartProvider/);
  });
});
