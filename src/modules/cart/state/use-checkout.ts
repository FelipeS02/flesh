"use client";

import { useCallback, useRef, useState } from "react";
import type { CheckoutOutcome, CheckoutPort } from "../api/port";
import type { CartView } from "../domain/line";

/**
 * An explicit three-phase machine, not an `isPending` boolean.
 *
 * `useTransition` is the documented Next pending mechanism and would be the
 * right upgrade the day `startCheckout` becomes a Server Function — it is
 * recorded here as exactly that. It is rejected as the source of truth today
 * for one reason: a boolean cannot HOLD the outcome, and the `unavailable`
 * message has to stay on screen after the call finishes. A `disabled` CTA has
 * nowhere to put it either.
 */
export type CheckoutUiState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "settled"; outcome: CheckoutOutcome };

export type CheckoutMachine = {
  state: CheckoutUiState;
  start: (cart: CartView) => void;
};

/**
 * Drives one checkout attempt against an injected port.
 *
 * `pending` is set SYNCHRONOUSLY before the await. Today's local port resolves
 * immediately, so React may batch pending and settled into a single commit and
 * the pending frame may never paint — that is correct and deliberate. The
 * machine exists, it is exercised, and it will produce a visible frame the day
 * the port does real IO. Padding with a timer to make the spinner appear is
 * rejected: faking latency to demo a loading state is the dishonesty this seam
 * exists to avoid.
 *
 * The port is a parameter rather than something this hook builds, and that is
 * what makes `pending` testable at all — a deferred fake is the only way to
 * hold the promise open long enough for the phase to be observed.
 */
export function useCheckout(port: CheckoutPort): CheckoutMachine {
  const [state, setState] = useState<CheckoutUiState>({ phase: "idle" });

  /**
   * The re-entrancy guard is a ref, not the rendered state, and it has to be:
   * a double-click puts both calls in the same tick, where `state` is still
   * `idle` for the second one. No request-id bookkeeping beyond this — at one
   * CTA with one in-flight call, anything more would be machinery guarding a
   * case that cannot occur.
   */
  const inFlight = useRef(false);

  const start = useCallback(
    (cart: CartView) => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setState({ phase: "pending" });

      void port.startCheckout(cart).then((outcome) => {
        inFlight.current = false;
        setState({ phase: "settled", outcome });
      });
    },
    [port],
  );

  return { state, start };
}
