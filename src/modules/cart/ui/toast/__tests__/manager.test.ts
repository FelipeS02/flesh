import { afterEach, describe, expect, it, vi } from "vitest";
import { ADDED_TO_CART_TOAST_ID, cartToastManager, showAddedToCart } from "../manager";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("showAddedToCart", () => {
  it("adds with the fixed id and low priority, and NEVER updates — add() upserts and resets the timer, update() does not (gotcha #2)", () => {
    const add = vi.spyOn(cartToastManager, "add");
    const update = vi.spyOn(cartToastManager, "update");

    showAddedToCart({ variantId: 201, repeat: false });

    expect(add).toHaveBeenCalledWith({
      id: ADDED_TO_CART_TOAST_ID,
      priority: "low",
      data: { variantId: 201, repeat: false },
    });
    expect(update).not.toHaveBeenCalled();
  });

  // T9 — the toast MUST be safe to fire from `PurchasePanel` regardless of
  // whether a `CartToastViewport` happens to be mounted. `createToastManager()`
  // holds only a listener `Set` (no provider, no listeners): `add()` emits
  // into an empty set and the event is simply dropped.
  it("does not throw when no toast viewport is mounted", () => {
    expect(() => showAddedToCart({ variantId: 999, repeat: true })).not.toThrow();
  });

  // T13 — at the manager layer (no `Toast.Provider` in this file at all),
  // there is structurally nothing a toast could persist INTO between calls:
  // unlike `useToastManager()`'s return value, the plain `ToastManager`
  // `createToastManager()` returns exposes no `toasts` list to leak. Every
  // toast, timer and transition lives in the (unmounted, per-test) provider
  // store instead — see `cart-toast-viewport.test.tsx` for the rendered proof.
  it("holds no toast state of its own for a call to leave behind", () => {
    showAddedToCart({ variantId: 201, repeat: false });

    expect(cartToastManager).not.toHaveProperty("toasts");
  });
});
