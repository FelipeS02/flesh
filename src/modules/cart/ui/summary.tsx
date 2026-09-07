"use client";

import { formatMoney } from "@/modules/catalog/client";
import { totals } from "../domain/selectors";
import { useCartEnvironment, useCartState } from "../state/cart-context";

/**
 * The payment-method breakdown uses the same pure selector as every other
 * cart consumer. The rate comes from the server-resolved environment rather
 * than a markup-side constant, so the PDP and drawer cannot quietly drift.
 */
export function CartSummary() {
  const state = useCartState();
  const { transferRateBp } = useCartEnvironment();

  if (state.status !== "ready" || state.lines.length === 0) {
    return null;
  }

  const breakdown = totals(state.lines, transferRateBp);

  return (
    <section aria-label="Resumen del carrito" className="border-t border-border pt-4">
      <dl className="space-y-2 font-sans text-sm tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{formatMoney(breakdown.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <dt>Descuento por transferencia</dt>
          <dd>-{formatMoney(breakdown.discount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3 font-display text-lg">
          <dt>Total</dt>
          <dd>{formatMoney(breakdown.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
