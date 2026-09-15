"use client";

import { useCallback, useRef, useState } from "react";
import { CHECKOUT_FAILURE_REASON } from "../api/checkout-messages";
import { isSafeCheckoutUrl } from "../api/checkout-url";
import type { CheckoutOutcome, CheckoutPort } from "../api/port";
import type { CartView } from "../domain/line";

export type CheckoutUiState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "settled"; outcome: CheckoutOutcome };
export type CheckoutMachine = { state: CheckoutUiState; start: (cart: CartView) => void };

/** Prevents duplicate requests and always settles failures into an actionable UI state. */
export function useCheckout(port: CheckoutPort): CheckoutMachine {
  const [state, setState] = useState<CheckoutUiState>({ phase: "idle" });
  const inFlight = useRef(false);
  const start = useCallback((cart: CartView) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ phase: "pending" });
    void (async () => {
      try {
        const outcome = await port.startCheckout(cart);
        if (outcome.status === "redirect") {
          if (!isSafeCheckoutUrl(outcome.url)) setState({ phase: "settled", outcome: { status: "unavailable", reason: CHECKOUT_FAILURE_REASON } });
          else setState({ phase: "settled", outcome });
        } else setState({ phase: "settled", outcome });
      } catch {
        setState({ phase: "settled", outcome: { status: "unavailable", reason: CHECKOUT_FAILURE_REASON } });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [port]);
  return { state, start };
}
