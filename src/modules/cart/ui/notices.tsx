"use client";

import { X } from "lucide-react";
import { formatMoney } from "@/modules/catalog/client";
import type { CartNotice } from "../domain/line";
import { useCartDispatch, useCartState } from "../state/cart-context";

/** Pending rehydration events. They remain until the shopper dismisses them. */
export function CartNotices() {
  const state = useCartState();
  const dispatch = useCartDispatch();

  if (state.status !== "ready" || state.notices.length === 0) {
    return null;
  }

  return (
    <section aria-label="Avisos del carrito" aria-live="polite">
      {state.notices.map((notice) => {
        const copy = noticeCopy(notice);
        const name = notice.item ?? "un producto";

        return (
          <div key={notice.variantId} className="flex gap-3 border-b border-border py-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 ${notice.kind === "removed" ? "bg-destructive" : "bg-foreground"}`}
            />
            <p className="flex-1 font-sans text-sm tracking-control text-foreground">{copy}</p>
            <button
              type="button"
              aria-label={`Cerrar aviso de ${name}`}
              onClick={() => dispatch({ type: "dismissNotice", variantId: notice.variantId })}
              className="shrink-0 text-muted-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </section>
  );
}

function noticeCopy(notice: CartNotice): string {
  if (notice.kind === "repriced") {
    return `${notice.item} cambió de ${formatMoney(notice.from)} a ${formatMoney(notice.to)}.`;
  }

  return notice.item
    ? `${notice.item} ya no está disponible.`
    : "Un producto ya no está disponible.";
}
