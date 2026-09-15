"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createEcommerceEvent,
  sendAnalyticsEvent,
  type AnalyticsItem,
} from "@/modules/analytics";
import type { CartLine } from "../domain/line";
import { useCartDispatch } from "../state/cart-context";

type StepperProps = {
  line: CartLine;
  analyticsItem: AnalyticsItem;
  /** From `purchaseLimit` (catalog/client.ts) — `null` means no ceiling. */
  limit: number | null;
};

/**
 * The quantity control for one line — tasks 3a.5/3a.6.
 *
 * "No `setQuantity`" is design D7's own rule: the artboards show a stepper
 * and a `QUITAR` action, never a free-text input, so this dispatches only
 * `increment` / `decrement`.
 *
 * The remove action is NOT here, even though the two were one component
 * until the drawer was brought in line with the `Cart Items / Promocion`
 * artboard. That board puts `QUITAR` on the title row beside the garment's
 * name and the stepper on the bottom row beside the price — two different
 * rows, so they cannot be one box. See `RemoveLineButton`.
 *
 * Decrementing at quantity 1 is NOT special-cased here. It dispatches the
 * same `decrement` unconditionally, and the reducer's own remove-at-zero
 * rule (already proven in `reducer.test.ts`) removes the line. Clamping the
 * button at 1 would duplicate a rule that already lives in exactly one
 * place, and duplicating it is how the two would eventually disagree.
 */
export function Stepper({ line, limit, analyticsItem }: StepperProps) {
  const dispatch = useCartDispatch();

  function updateQuantity(
    action: "increment" | "decrement",
    eventName: "add_to_cart" | "remove_from_cart",
  ) {
    if (action === "increment") {
      dispatch({ type: "increment", variantId: line.variantId, limit });
    } else {
      dispatch({ type: "decrement", variantId: line.variantId });
    }
    sendAnalyticsEvent(
      createEcommerceEvent(eventName, [
        { ...analyticsItem, quantity: 1 },
      ]),
    );
  }

  return (
    <div
      role="group"
      aria-label="Cantidad"
      className="flex items-center font-sans text-sm text-foreground"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Restar"
        onClick={() => updateQuantity("decrement", "remove_from_cart")}
        className="size-8.5"
      >
        <MinusIcon />
      </Button>
      <span
        className="flex size-8.5 items-center justify-center tabular-nums"
        aria-live="polite"
      >
        {line.quantity}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Sumar"
        onClick={() => updateQuantity("increment", "add_to_cart")}
        // Affordance only — same reasoning as decrement's NON-clamp above, in
        // reverse: the reducer already refuses to grow past `limit` (proven in
        // `reducer.test.ts`'s "purchase limit" suite), so this disables the
        // click rather than duplicating that ceiling here.
        disabled={limit !== null && line.quantity >= limit}
        className="size-8.5"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
