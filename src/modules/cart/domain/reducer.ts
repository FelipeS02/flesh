import type { Money } from "@/modules/catalog/client";
import type { CartLine, CartLineId, CartNotice } from "./line";

/**
 * What every surface reading the cart is allowed to see — a DISCRIMINATED
 * UNION, deliberately not `{ lines, hydration: "pending" | "ready" }`.
 *
 * With a flag, `lines` is always readable and every consumer has to REMEMBER
 * to check the flag first. "Zero lines renders the empty state" would then be
 * true of a cart that simply has not been read yet, which is exactly the bug:
 * a badge showing 0 that jumps to 3 is a glitch, and "Tu carrito esta vacio"
 * over three stored garments is a lie with the face of authority — worse than
 * showing nothing. With the union, `state.lines.length === 0` DOES NOT COMPILE
 * while hydrating. The compiler enforces what a comment could only ask for.
 *
 * This is the same discipline `line.ts` already applies to `CartNotice.item`,
 * where the type makes an asymmetry a compile-time fact instead of a runtime
 * fallback a caller could forget.
 *
 * The rule it encodes: while the cart is hydrating, no surface asserts a fact
 * about it that it does not yet know. This is a CORRECTNESS requirement, not a
 * spinner — reading `localStorage` and running `reconcile` have no await, so
 * the window is one frame and nobody will ever see a loading indicator.
 *
 * Two mechanisms were considered and rejected. SUSPENSE suspends on a promise;
 * `localStorage` is synchronous, so it would mean fabricating a promise around
 * a read that does not need one just to borrow a scheduling primitive — and it
 * does not model the real asynchrony here, which is that the client exists
 * AFTER the server. `useSyncExternalStore` with `getServerSnapshot` fixes the
 * hydration mismatch but gives no semantic difference between "empty because I
 * have not loaded" and "empty because it is empty"; it solves the mechanism,
 * not the meaning.
 *
 * Accepted cost: every consumer must narrow before reading anything. That
 * verbosity IS the guarantee.
 */
export type CartState =
  | { status: "hydrating" }
  | { status: "ready"; lines: CartLine[]; notices: CartNotice[] };

/**
 * The reducer's own state, which is `CartState` plus one field: the lines a
 * shopper added BEFORE storage was read.
 *
 * That buffer has to exist somewhere — a click landing between mount and the
 * read effect must not be thrown away (design D4, ordering hazard 3) — and the
 * reducer is the only honest place for it, since anywhere else would be a
 * second source of truth for the same cart.
 *
 * It is a separate type from `CartState` precisely so it does not leak:
 * `useCartState()` hands out `CartState`, where `pendingLines` does not exist,
 * so no surface can reach for a partial count and reintroduce the glitch the
 * union was built to make impossible. The name says what it is — lines held in
 * flight, not the cart.
 */
export type CartReducerState =
  | { status: "hydrating"; pendingLines: CartLine[] }
  | { status: "ready"; lines: CartLine[]; notices: CartNotice[] };

/**
 * Hydrating, not empty. The server cannot read `localStorage` either, so the
 * server's HTML and the client's first render agree on this — which is also
 * how the union closes the SSR/hydration mismatch and the empty-first-paint
 * flash, a gap the task list had listed as uncovered.
 */
export const initialCartState: CartReducerState = { status: "hydrating", pendingLines: [] };

/**
 * `add | increment | decrement | remove | clear` per design D7 — deliberately
 * NO `setQuantity`. The artboards show a stepper and a `QUITAR` remove action,
 * never a free-text quantity input; inventing one would be UI redesign.
 *
 * `rehydrate` and `dismissNotice` complete D7's action set. They arrive here
 * with the slice that first has a consumer for them (`CartProvider`), as the
 * tasks doc anticipated: `rehydrate` is the single dispatch the mount effect
 * makes after reading storage and reconciling, and `dismissNotice` is the one
 * path that removes a notice — which reaches storage through the write effect,
 * so a dismissal is not merely cosmetic (design D3/D4).
 */
export type CartAction =
  | { type: "add"; productId: number; variantId: CartLineId; price: Money; quantity?: number }
  | { type: "increment"; variantId: CartLineId }
  | { type: "decrement"; variantId: CartLineId }
  | { type: "remove"; variantId: CartLineId }
  | { type: "clear" }
  | { type: "rehydrate"; lines: CartLine[]; notices: CartNotice[] }
  | { type: "dismissNotice"; variantId: CartLineId };

/**
 * Pure — no IO, no catalog lookup. `add` is the only action that can create a
 * line; every other action targets a `variantId` that either already exists
 * (mutated) or does not (silently a no-op, never an error) — a stepper click
 * racing a `remove` must not throw.
 *
 * Every line-editing action works on whichever list the current status holds,
 * so the stepper behaves identically before and after hydration. Only the
 * VISIBILITY of the cart changes across that boundary, never its rules.
 */
export function cartReducer(state: CartReducerState, action: CartAction): CartReducerState {
  switch (action.type) {
    case "add":
      return withLines(state, addLine(heldLines(state), action));
    case "increment":
      return withLines(state, adjustQuantity(heldLines(state), action.variantId, 1));
    case "decrement":
      return withLines(state, adjustQuantity(heldLines(state), action.variantId, -1));
    case "remove":
      return withLines(
        state,
        heldLines(state).filter((line) => line.variantId !== action.variantId),
      );
    case "clear":
      // Lines only. A notice records something that already happened to this
      // cart, and emptying the cart does not un-happen it.
      return withLines(state, []);
    case "rehydrate":
      return rehydrate(state, action);
    case "dismissNotice":
      return dismissNotice(state, action.variantId);
  }
}

/**
 * The one dispatch the mount effect makes, and the only transition into
 * `ready` — including when storage held nothing at all. An absent record is an
 * ANSWER, not a reason to keep waiting: without this the provider would never
 * leave `hydrating` and every surface would sit forever on a cart that was
 * never there.
 *
 * It MERGES rather than replaces, using the same rule as `add` (same
 * `variantId` → quantities sum), so a click that landed between mount and the
 * read effect survives. The race is therefore covered by a pure unit test
 * instead of by timing.
 *
 * Stored lines come first and keep their price: `reconcile` has just checked
 * that price against the live catalog, which is the freshest verdict available.
 * The action's notices are authoritative for the same reason — `reconcile`
 * already merged the still-pending persisted ones with what it just detected.
 */
function rehydrate(
  state: CartReducerState,
  action: Extract<CartAction, { type: "rehydrate" }>,
): CartReducerState {
  const merged = heldLines(state).reduce(
    (lines, held) =>
      addLine(lines, {
        type: "add",
        productId: held.productId,
        variantId: held.variantId,
        price: held.price,
        quantity: held.quantity,
      }),
    action.lines,
  );

  return { status: "ready", lines: merged, notices: action.notices };
}

/**
 * The only action that removes a notice. While hydrating there is nothing to
 * dismiss — no notice has been read yet — so the state is returned untouched
 * rather than being forced into `ready` with an empty list, which would claim
 * the cart is known when it is not.
 */
function dismissNotice(state: CartReducerState, variantId: CartLineId): CartReducerState {
  if (state.status === "hydrating") {
    return state;
  }

  return {
    ...state,
    notices: state.notices.filter((notice) => notice.variantId !== variantId),
  };
}

/** The lines the current status holds, whatever it calls them. */
function heldLines(state: CartReducerState): CartLine[] {
  return state.status === "hydrating" ? state.pendingLines : state.lines;
}

/**
 * Replaces the held lines without changing status. Hydration is flipped by
 * `rehydrate` alone, so no stepper click can ever declare the cart known.
 */
function withLines(state: CartReducerState, lines: CartLine[]): CartReducerState {
  return state.status === "hydrating"
    ? { status: "hydrating", pendingLines: lines }
    : { ...state, lines };
}

/**
 * Merges on `variantId` — the cart MUST never hold two lines for one variant
 * (spec: "Cart line item lifecycle"). Merging here, not just in `increment`, is
 * what makes repeated "Add to cart" clicks on the PDP safe, and it is reused by
 * `rehydrate` so the mid-flight race resolves by exactly the same rule.
 */
function addLine(
  lines: CartLine[],
  action: Extract<CartAction, { type: "add" }>,
): CartLine[] {
  const quantity = action.quantity ?? 1;
  const existing = lines.find((line) => line.variantId === action.variantId);

  if (existing) {
    return lines.map((line) =>
      line.variantId === action.variantId
        ? { ...line, quantity: line.quantity + quantity }
        : line,
    );
  }

  return [
    ...lines,
    { productId: action.productId, variantId: action.variantId, price: action.price, quantity },
  ];
}

/**
 * Shared by `increment`/`decrement` so the "remove at zero" rule lives in
 * exactly one place — `decrement` never emits a `quantity: 0` line for a
 * caller to accidentally render.
 */
function adjustQuantity(lines: CartLine[], variantId: CartLineId, delta: number): CartLine[] {
  return lines
    .map((line) => (line.variantId === variantId ? { ...line, quantity: line.quantity + delta } : line))
    .filter((line) => line.quantity > 0);
}
