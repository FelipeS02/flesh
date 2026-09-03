"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ActionDispatch,
  type ReactNode,
} from "react";
import { createLocalCheckout } from "../api/checkout.local";
import type { CheckoutPort } from "../api/port";
import { createCartStorage, type CartStoragePort } from "../api/storage";
import { indexCartCatalog, type CartCatalog } from "../domain/catalog-projection";
import type { CartLine, CartNotice } from "../domain/line";
import { reconcile, type StoredCart, type StoredCartNotice } from "../domain/reconcile";
import {
  cartReducer,
  initialCartState,
  type CartAction,
  type CartState,
} from "../domain/reducer";

/**
 * Two contexts, and the reason is ENCAPSULATION rather than re-render cost.
 * The React Compiler is on, and at three SKUs the propagation argument is
 * worth nothing. What is worth something: a component importing
 * `useCartDispatch` CANNOT read totals, and one importing `useCartState`
 * CANNOT mutate. "Who is allowed to change the cart" becomes a type-level
 * fact, and the PDP's add button and the header's badge sit on opposite sides
 * of that line.
 *
 * `null` as the default is deliberate — see the hooks below. A default value
 * shaped like an empty cart would let a component outside the provider render
 * as though the cart were known and empty, which is the same lie the hydration
 * union exists to forbid, arriving through a different door.
 */
const CartStateContext = createContext<CartState | null>(null);
const CartDispatchContext = createContext<ActionDispatch<[CartAction]> | null>(null);

/**
 * Everything the server resolved and handed down, kept apart from the two
 * above because it never changes for the life of the tree. `transferRateBp`
 * lives here so the summary reads the rate the store actually configured
 * rather than a constant next to the markup — the spec's "the rate must not be
 * a module constant read at call sites" applies to the cart exactly as it
 * applies to the PDP.
 */
export type CartEnvironment = {
  catalog: CartCatalog;
  transferRateBp: number;
  checkout: CheckoutPort;
};

const CartEnvironmentContext = createContext<CartEnvironment | null>(null);

type CartProviderProps = {
  /** The server's narrow projection (design D1). Plain data, never a port. */
  catalog: CartCatalog;
  /** Resolved by `getPricingPolicy()` on the server; a plain number here. */
  transferRateBp: number;
  /**
   * Test-only injection. NEVER supplied from a Server Component: functions are
   * not serializable across the RSC boundary, so `layout.tsx` passes plain
   * data only. A deferred fake port passed from client-side test code is what
   * makes the checkout machine's `pending` phase observable at all (D6).
   */
  checkout?: CheckoutPort;
  /**
   * Same seam, one layer down. Defaults to `window.localStorage` — built
   * LAZILY inside the mount effect, never at import time, for exactly the
   * reason `createCartStorage` already documents: touching `window` while this
   * module is evaluated breaks the moment it is pulled into a server render.
   */
  storage?: CartStoragePort;
  children: ReactNode;
};

export function CartProvider({
  catalog,
  transferRateBp,
  checkout,
  storage,
  children,
}: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const storageRef = useRef<CartStoragePort | null>(null);

  /**
   * The read happens in an EFFECT, not in a `useReducer` lazy initializer, and
   * that is not a style choice: this provider also renders on the server,
   * where `window` does not exist, so an initializer reading storage would
   * produce a hydration mismatch. The union makes the cost of that decision
   * honest — the first paint says "hydrating", not "empty".
   *
   * Exactly ONE dispatch, carrying the pure result of `reconcile`. The effect
   * does the IO; the reducer does the reasoning.
   *
   * An absent record still dispatches, with empty lines and notices. Returning
   * early on `null` is the bug that would leave the provider hydrating forever.
   */
  useEffect(() => {
    const store = (storageRef.current ??= storage ?? createCartStorage(window.localStorage));
    const stored = store.read();
    const { lines, notices } = stored
      ? reconcile(stored, indexCartCatalog(catalog))
      : { lines: [], notices: [] };

    dispatch({ type: "rehydrate", lines, notices });
    // Mount only. Re-reading storage on a catalog change would re-apply drift
    // the shopper has already been told about, and the snapshot is fixed for
    // the page's lifetime anyway (design D4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * SKIPPED while hydrating, and this is the whole reason the status exists in
   * the reducer rather than only in the UI. Without the guard, the empty
   * initial state is written over the stored cart — and now over its pending
   * notices too — before either has ever been read. That is the classic
   * localStorage-provider bug; it is designed out here rather than debugged
   * later.
   *
   * Keyed on lines AND notices because a dismissal must reach storage: if this
   * effect watched only lines, dismissing a notice would be cosmetic and the
   * notice would resurrect on the next reload (design D3/D4).
   */
  useEffect(() => {
    if (state.status === "hydrating") {
      return;
    }

    storageRef.current?.write(toStoredCart(state.lines, state.notices));
  }, [state]);

  const environment = useMemo<CartEnvironment>(
    () => ({
      catalog,
      transferRateBp,
      // The local port re-checks availability against this same projection.
      // Building it here rather than at the call site keeps the closure over
      // the catalog in one place — the catalog itself is unreachable from
      // client code (design D1), so a component could not build one anyway.
      checkout: checkout ?? createLocalCheckout(catalog),
    }),
    [catalog, transferRateBp, checkout],
  );

  return (
    <CartEnvironmentContext.Provider value={environment}>
      <CartDispatchContext.Provider value={dispatch}>
        <CartStateContext.Provider value={state}>{children}</CartStateContext.Provider>
      </CartDispatchContext.Provider>
    </CartEnvironmentContext.Provider>
  );
}

/**
 * Returns the discriminated union, so a caller must narrow on `status` before
 * it can read a single line. That verbosity IS the guarantee: while the cart
 * is hydrating, no surface can assert a fact about it that it does not yet
 * know.
 */
export function useCartState(): CartState {
  return required(useContext(CartStateContext), "useCartState");
}

export function useCartDispatch(): ActionDispatch<[CartAction]> {
  return required(useContext(CartDispatchContext), "useCartDispatch");
}

export function useCartEnvironment(): CartEnvironment {
  return required(useContext(CartEnvironmentContext), "useCartEnvironment");
}

/**
 * Throwing, not falling back. A hook that quietly returned an empty cart when
 * the provider is missing would turn a wiring mistake into a shopper staring
 * at a cart that is permanently empty and never says why.
 */
function required<T>(value: T | null, hook: string): T {
  if (value === null) {
    throw new Error(`${hook} must be used inside a <CartProvider>.`);
  }

  return value;
}

/**
 * The one place live cart state becomes the persisted shape, and the mapping
 * is deliberately lossy in both directions that matter.
 *
 * A line's `Money` collapses to `unitPriceMinor` + `currency`: that pair is a
 * WITNESS used only to detect drift on the next load, never for arithmetic or
 * display (design D3). Nothing else about the line is persisted — no title, no
 * combination, no image — so a renamed product cannot render from a stale copy.
 *
 * A notice keeps its `item` label, and it is the one display string in the
 * payload. It is stored because it is not a view onto anything live: a notice
 * is a record of what the shopper was TOLD, in the same sense the price
 * witness is a record of the price they were shown. The `unknown-variant` case
 * proves the point — its label has nothing left to re-derive from.
 */
function toStoredCart(lines: CartLine[], notices: CartNotice[]): StoredCart {
  return {
    lines: lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceMinor: line.price.amount,
      currency: line.price.currency,
    })),
    notices: notices.map(toStoredNotice),
  };
}

/** Only `repriced` carries `Money`, so only `repriced` needs flattening. */
function toStoredNotice(notice: CartNotice): StoredCartNotice {
  if (notice.kind === "repriced") {
    return {
      kind: "repriced",
      variantId: notice.variantId,
      item: notice.item,
      fromMinor: notice.from.amount,
      toMinor: notice.to.amount,
      currency: notice.to.currency,
    };
  }

  return notice;
}
