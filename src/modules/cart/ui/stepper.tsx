"use client";

import type { CartLine } from "../domain/line";
import { useCartDispatch } from "../state/cart-context";

type StepperProps = {
  line: CartLine;
};

/**
 * Quantity control plus the explicit remove for one line — tasks 3a.5/3a.6.
 *
 * "No `setQuantity`" is design D7's own rule: the artboards show a stepper
 * and a `QUITAR` action, never a free-text input, so this dispatches only
 * `increment` / `decrement` / `remove`.
 *
 * Decrementing at quantity 1 is NOT special-cased here. It dispatches the
 * same `decrement` unconditionally, and the reducer's own remove-at-zero
 * rule (already proven in `reducer.test.ts`) removes the line. Clamping the
 * button at 1 would duplicate a rule that already lives in exactly one
 * place, and duplicating it is how the two would eventually disagree.
 */
export function Stepper({ line }: StepperProps) {
  const dispatch = useCartDispatch();

  return (
    <div className="flex items-center gap-4">
      <div
        role="group"
        aria-label="Cantidad"
        className="flex items-center gap-3 font-sans text-sm text-foreground"
      >
        <button
          type="button"
          aria-label="Restar"
          onClick={() => dispatch({ type: "decrement", variantId: line.variantId })}
          className="flex size-7 items-center justify-center border border-border"
        >
          −
        </button>
        <span className="tabular-nums" aria-live="polite">
          {line.quantity}
        </span>
        <button
          type="button"
          aria-label="Sumar"
          onClick={() => dispatch({ type: "increment", variantId: line.variantId })}
          className="flex size-7 items-center justify-center border border-border"
        >
          +
        </button>
      </div>

      {/* The explicit remove, distinct from decrement — it drops the line at
          any quantity, not only at 1 (spec: "Explicit remove and clear"). */}
      <button
        type="button"
        onClick={() => dispatch({ type: "remove", variantId: line.variantId })}
        className="font-display text-xs tracking-control text-muted-foreground md:text-sm"
      >
        QUITAR
      </button>
    </div>
  );
}
