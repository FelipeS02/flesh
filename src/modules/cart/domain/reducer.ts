import type { Money } from "@/modules/catalog/client";
import type { CartLine, CartLineId } from "./line";

/**
 * `add | increment | decrement | remove | clear` only, per design D7 and
 * task 1b.4 — deliberately NO `setQuantity`. The artboards show a stepper
 * and a `QUITAR` remove action, never a free-text quantity input; inventing
 * one would be UI redesign, not domain work.
 *
 * `rehydrate` and `dismissNotice` (D4/D7's fuller action set) are NOT part
 * of this reducer yet — they belong to whichever slice first has a
 * consumer for them (PR2b's `CartProvider`, per the tasks doc), and adding
 * them here without that consumer would be scope no task assigned.
 */
export type CartAction =
  | { type: "add"; productId: number; variantId: CartLineId; price: Money; quantity?: number }
  | { type: "increment"; variantId: CartLineId }
  | { type: "decrement"; variantId: CartLineId }
  | { type: "remove"; variantId: CartLineId }
  | { type: "clear" };

/**
 * Pure — no IO, no catalog lookup. `add` is the only action that can create
 * a line; every other action targets a `variantId` that either already
 * exists (mutated) or does not (silently a no-op, never an error) — a
 * stepper click racing a `remove` must not throw.
 */
export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add":
      return addLine(lines, action);
    case "increment":
      return adjustQuantity(lines, action.variantId, 1);
    case "decrement":
      return adjustQuantity(lines, action.variantId, -1);
    case "remove":
      return lines.filter((line) => line.variantId !== action.variantId);
    case "clear":
      return [];
  }
}

/**
 * Merges on `variantId` — the cart MUST never hold two lines for one
 * variant (spec: "Cart line item lifecycle"). Merging here, not just in
 * `increment`, is what makes repeated "Add to cart" clicks on the PDP safe.
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
