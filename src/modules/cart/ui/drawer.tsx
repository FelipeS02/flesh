"use client";

import { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { EmptyState } from "./empty-state";
import { LineRow } from "./line-row";
import { CartNotices } from "./notices";
import { CartSummary } from "./summary";
import { useCartState } from "../state/cart-context";

type CartDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * A controlled drawer so its eventual header trigger (PR4) owns the open
 * state. The component is still complete on its own: dialog semantics,
 * Escape, focus return, loading truthfulness, and the fixed/scrolling regions
 * all live at this boundary rather than in a future trigger.
 */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const state = useCartState();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButtonRef.current?.focus();
    }
  }, [open]);

  function close() {
    onOpenChange(false);
    // The controlled parent removes the dialog in the same event turn. Return
    // focus after that removal so the browser cannot discard it with the
    // focused close button's unmount.
    window.setTimeout(() => returnFocusRef.current?.focus());
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onMouseDown={close}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
          }
        }}
        className="flex h-full w-full max-w-md flex-col bg-background p-6 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="font-display text-2xl text-foreground">Carrito</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Cerrar carrito"
            onClick={close}
            className="text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        {state.status === "hydrating" ? (
          <p className="flex flex-1 items-center justify-center font-sans text-sm text-muted-foreground">
            Cargando carrito…
          </p>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {state.lines.map((line) => (
                <LineRow key={line.variantId} line={line} />
              ))}
              <EmptyState state={state} />
            </div>
            <div className="h-48 shrink-0 overflow-y-auto">
              <CartNotices />
            </div>
            <div className="shrink-0 pt-4">
              <CartSummary />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
