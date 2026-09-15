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
import { createTiendanubeCheckout } from "../api/checkout.client";
import { createBuyerProfilePort } from "../api/buyer-profile.client";
import { createOrderStatusPort } from "../api/order-status.client";
import { clearHandoffMarker, hasHandoffMarker } from "../api/handoff-marker";
import type { BuyerProfilePort, CheckoutPort, OrderStatusPort } from "../api/port";
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
 * `null` as the default is deliberate â€” see the hooks below. A default value
 * shaped like an empty cart would let a component outside the provider render
 * as though the cart were known and empty, which is the same lie the hydration
 * union exists to forbid, arriving through a different door.
 */
/**
 * The longest the cart stays hidden waiting to hear whether it was already
 * bought. Sized above the server read's own timeout so the usual answer arrives
 * first; when it does fire, the stored cart is shown rather than withheld.
 */
const HANDOFF_ANSWER_CEILING_MS = 6_000;

const CartStateContext = createContext<CartState | null>(null);
const CartDispatchContext = createContext<ActionDispatch<[CartAction]> | null>(null);

/**
 * Everything the server resolved and handed down, kept apart from the two
 * above because it never changes for the life of the tree. `transferRateBp`
 * lives here so the summary reads the rate the store actually configured
 * rather than a constant next to the markup â€” the spec's "the rate must not be
 * a module constant read at call sites" applies to the cart exactly as it
 * applies to the PDP.
 */
export type CartEnvironment = {
  catalog: CartCatalog;
  transferRateBp: number;
  checkout: CheckoutPort;
  buyerProfile: BuyerProfilePort;
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
  /** Same seam as `checkout`, for the skip-path read (design D2). */
  buyerProfile?: BuyerProfilePort;
  /** Same seam again, for the returning-shopper check below. */
  orderStatus?: OrderStatusPort;
  /**
   * Same seam, one layer down. Defaults to `window.localStorage` â€” built
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
  buyerProfile,
  orderStatus,
  storage,
  children,
}: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const storageRef = useRef<CartStoragePort | null>(null);
  const decided = useRef(false);

  /**
   * The read happens in an EFFECT, not in a `useReducer` lazy initializer, and
   * that is not a style choice: this provider also renders on the server,
   * where `window` does not exist, so an initializer reading storage would
   * produce a hydration mismatch. The union makes the cost of that decision
   * honest â€” the first paint says "hydrating", not "empty".
   *
   * Exactly ONE dispatch, carrying the pure result of `reconcile`. The effect
   * does the IO; the reducer does the reasoning.
   *
   * An absent record still dispatches, with empty lines and notices. Returning
   * early on `null` is the bug that would leave the provider hydrating forever.
   */
  useEffect(() => {
    // Guarded by a ref rather than left to run per mount, because the answer
    // below is ONE-SHOT: the server deletes the pending-order cookie as it
    // answers yes, so asking twice spends it. Strict Mode mounts effects twice
    // in development, and without this the throwaway first run consumed the
    // answer while the second found nothing — the cookie vanished and the cart
    // stayed full, which is exactly how this shipped broken once.
    if (decided.current) return;
    decided.current = true;

    const store = (storageRef.current ??= storage ?? createCartStorage(window.localStorage));
    const stored = store.read();
    const restored = stored
      ? reconcile(stored, indexCartCatalog(catalog))
      : { lines: [], notices: [] };

    // No handoff pending is the overwhelmingly common case, and it costs
    // nothing: the cart paints immediately and the server is never asked.
    if (!hasHandoffMarker()) {
      dispatch({ type: "rehydrate", ...restored });
      return;
    }

    // From here the shopper may have just bought this cart. Showing the lines
    // now and removing them a moment later is the flicker this avoids, so the
    // provider stays `hydrating` — where the header shows no badge and the
    // drawer says it is loading — until there is an answer.
    let settled = false;
    const settle = (lines: CartLine[], notices: CartNotice[]) => {
      if (settled) return;
      settled = true;
      clearHandoffMarker();
      dispatch({ type: "rehydrate", lines, notices });
    };

    // A ceiling on that wait: past it the cart is shown as stored rather than
    // withheld forever.
    //
    // `settled` keeps a late answer from dispatching again. It is NOT what makes
    // that safe — the reducer already ignores a second `rehydrate` once the cart
    // is ready (see its own note on folding a ready cart into itself), so the
    // shown cart survives a late yes either way. This latch just stops the
    // pointless second dispatch and the second marker clear.
    const ceiling = setTimeout(
      () => settle(restored.lines, restored.notices),
      HANDOFF_ANSWER_CEILING_MS,
    );

    const port = orderStatus ?? createOrderStatusPort();
    void port
      .hasCompletedCheckout()
      .then((completed) =>
        completed ? settle([], []) : settle(restored.lines, restored.notices),
      )
      .catch(() => settle(restored.lines, restored.notices))
      .finally(() => clearTimeout(ceiling));
    // Mount only. Re-reading storage on a catalog change would re-apply drift
    // the shopper has already been told about, and the snapshot is fixed for
    // the page's lifetime anyway (design D4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * SKIPPED while hydrating, and this is the whole reason the status exists in
   * the reducer rather than only in the UI. Without the guard, the empty
   * initial state is written over the stored cart â€” and now over its pending
   * notices too â€” before either has ever been read. That is the classic
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
      // the catalog in one place â€” the catalog itself is unreachable from
      // client code (design D1), so a component could not build one anyway.
      checkout: checkout ?? createTiendanubeCheckout(),
      buyerProfile: buyerProfile ?? createBuyerProfilePort(),
    }),
    [catalog, transferRateBp, checkout, buyerProfile],
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
 * display (design D3). Nothing else about the line is persisted â€” no title, no
 * combination, no image â€” so a renamed product cannot render from a stale copy.
 *
 * A notice keeps its `item` label, and it is the one display string in the
 * payload. It is stored because it is not a view onto anything live: a notice
 * is a record of what the shopper was TOLD, in the same sense the price
 * witness is a record of the price they were shown. The `unknown-variant` case
 * proves the point â€” its label has nothing left to re-derive from.
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

