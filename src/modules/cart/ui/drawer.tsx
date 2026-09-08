"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "./empty-state";
import { LineRow } from "./line-row";
import { CartNotices } from "./notices";
import { CartSummary } from "./summary";
import { useCartEnvironment, useCartState } from "../state/cart-context";
import { useCheckout } from "../state/use-checkout";
import { indexCartCatalog, type CartCatalog } from "../domain/catalog-projection";
import type { CartLineId } from "../api/port";

type CartDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A controlled Sheet so the Header can own the cart trigger and open state. */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const state = useCartState();
  const { catalog, checkout } = useCartEnvironment();
  const checkoutMachine = useCheckout(checkout);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        initialFocus={closeButtonRef}
        className="w-full max-w-md gap-0 bg-background p-6 shadow-2xl sm:data-[side=right]:max-w-md"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-0 pb-4">
          <div>
            <SheetTitle className="font-display text-2xl text-foreground">Carrito</SheetTitle>
            <SheetDescription className="sr-only">Productos agregados al carrito.</SheetDescription>
          </div>
          <SheetClose
            ref={closeButtonRef}
            aria-label="Cerrar carrito"
            render={<button type="button" className="text-foreground" />}
          >
            <X aria-hidden="true" className="size-5" />
          </SheetClose>
        </SheetHeader>

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
              {state.lines.length > 0 && (
                <div className="pt-4">
                  <button
                    type="button"
                    disabled={checkoutMachine.state.phase === "pending"}
                    onClick={() => checkoutMachine.start({ lines: state.lines })}
                    className="h-14 w-full bg-primary font-display text-xl text-primary-foreground disabled:bg-muted disabled:text-muted-foreground md:h-16 md:text-2xl"
                  >
                    {checkoutMachine.state.phase === "pending"
                      ? "Finalizando compra..."
                      : "Finalizar compra"}
                  </button>
                  <CheckoutOutcome catalog={catalog} state={checkoutMachine.state} />
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type CheckoutOutcomeProps = {
  catalog: CartCatalog;
  state: ReturnType<typeof useCheckout>["state"];
};

function CheckoutOutcome({ catalog, state }: CheckoutOutcomeProps) {
  if (state.phase !== "settled") {
    return null;
  }

  const message =
    state.outcome.status === "unavailable"
      ? state.outcome.reason
      : state.outcome.status === "rejected"
        ? `Algunos productos ya no estan disponibles: ${describeRejectedLines(state.outcome.lines, catalog)}.`
        : "Redirigiendo al checkout…";

  return (
    <p role="alert" className="pt-3 font-sans text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function describeRejectedLines(lines: CartLineId[], catalog: CartCatalog): string {
  const index = indexCartCatalog(catalog);

  return lines
    .map((variantId) => {
      const entry = index.get(variantId);

      return entry
        ? `${entry.product.title} / ${entry.variant.combination.join(", ")}`
        : `Variante #${variantId}`;
    })
    .join(", ");
}
