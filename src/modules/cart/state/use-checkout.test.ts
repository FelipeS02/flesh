import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { CheckoutOutcome, CheckoutPort } from "../api/port";
import type { CartView } from "../domain/line";
import { useCheckout } from "./use-checkout";

/**
 * A port whose promise is resolved BY THE TEST, not by the implementation.
 *
 * This is the only reason `pending` is observable at all: the real local port
 * resolves immediately, so React batches pending and settled into a single
 * commit and the intermediate phase never reaches a rendered frame. Holding
 * the promise open is what turns a phase that exists in the code into a phase
 * a test can see — and it is why port injection is a design requirement rather
 * than a convenience.
 */
function deferredPort() {
  const calls: CartView[] = [];
  let settle: (outcome: CheckoutOutcome) => void = () => {};

  const port: CheckoutPort = {
    startCheckout(cart) {
      calls.push(cart);

      return new Promise<CheckoutOutcome>((resolve) => {
        settle = resolve;
      });
    },
  };

  return { port, calls, settle: (outcome: CheckoutOutcome) => settle(outcome) };
}

const CART: CartView = {
  lines: [{ productId: 101, variantId: 201, quantity: 1, price: { amount: 2_700_000, currency: "ARS" } }],
};

const UNAVAILABLE: CheckoutOutcome = { status: "unavailable", reason: "Sin checkout" };
const REJECTED: CheckoutOutcome = { status: "rejected", lines: [201] };

describe("useCheckout", () => {
  it("starts idle, having called nothing", () => {
    const { port, calls } = deferredPort();

    const { result } = renderHook(() => useCheckout(port));

    expect(result.current.state).toEqual({ phase: "idle" });
    expect(calls).toHaveLength(0);
  });

  it("is pending from the moment it asks until the port answers", () => {
    const { port, calls } = deferredPort();
    const { result } = renderHook(() => useCheckout(port));

    act(() => {
      result.current.start(CART);
    });

    expect(result.current.state).toEqual({ phase: "pending" });
    expect(calls).toEqual([CART]);
  });

  it("settles holding the outcome, not a boolean", async () => {
    const deferred = deferredPort();
    const { result } = renderHook(() => useCheckout(deferred.port));

    act(() => {
      result.current.start(CART);
    });
    await act(async () => {
      deferred.settle(UNAVAILABLE);
    });

    // The whole reason this is a machine and not `isPending`: the message has
    // to stay on screen after the call finishes, and a boolean has nowhere to
    // keep it.
    expect(result.current.state).toEqual({ phase: "settled", outcome: UNAVAILABLE });
  });

  it("carries a rejection's line ids through to the settled state", async () => {
    const deferred = deferredPort();
    const { result } = renderHook(() => useCheckout(deferred.port));

    act(() => {
      result.current.start(CART);
    });
    await act(async () => {
      deferred.settle(REJECTED);
    });

    expect(result.current.state).toEqual({ phase: "settled", outcome: REJECTED });
  });

  // A double-click on the CTA must not open two checkouts. Both calls land in
  // the same tick, so the guard cannot be the rendered state — that is still
  // `idle` when the second one reads it.
  it("ignores a second request while the first is still in flight", () => {
    const { port, calls } = deferredPort();
    const { result } = renderHook(() => useCheckout(port));

    act(() => {
      result.current.start(CART);
      result.current.start(CART);
    });

    expect(calls).toHaveLength(1);
    expect(result.current.state).toEqual({ phase: "pending" });
  });

  it("accepts a fresh attempt once the previous one has settled", async () => {
    const first = deferredPort();
    const { result } = renderHook(() => useCheckout(first.port));

    act(() => {
      result.current.start(CART);
    });
    await act(async () => {
      first.settle(REJECTED);
    });

    act(() => {
      result.current.start(CART);
    });

    // Back to pending, and the stale outcome is gone rather than lingering
    // under a new request.
    expect(result.current.state).toEqual({ phase: "pending" });
    expect(first.calls).toHaveLength(2);
  });
});
