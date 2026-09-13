import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { cartToastManager } from "./manager";
import { useDismissOnInteraction } from "./use-dismiss-on-interaction";

const TOAST_ID = "cart-added";

/** Flushes the hook's `requestAnimationFrame`-deferred listener attachment. */
async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

function Harness() {
  const rootRef = useDismissOnInteraction(TOAST_ID);

  return createElement(
    "div",
    null,
    createElement(
      "div",
      { ref: rootRef, "data-testid": "toast-root" },
      createElement("button", { type: "button", "data-testid": "inside-button" }, "close"),
    ),
    // Stands in for the PDP's add-to-cart control, which sits OUTSIDE the
    // toast and must not dismiss it — see the test below.
    createElement(
      "button",
      { type: "button", "data-cart-add": "", "data-testid": "add-button" },
      createElement("span", null, "Agregar al carrito"),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDismissOnInteraction", () => {
  it("closes the toast on a scroll outside the toast, on a mobile viewport", async () => {
    setViewport("mobile");
    const close = vi.spyOn(cartToastManager, "close");
    render(createElement(Harness));
    await flushFrame();

    fireEvent.scroll(window);

    expect(close).toHaveBeenCalledWith(TOAST_ID);
  });

  it("closes the toast on a pointerdown outside the toast, on a mobile viewport", async () => {
    setViewport("mobile");
    const close = vi.spyOn(cartToastManager, "close");
    render(createElement(Harness));
    await flushFrame();

    fireEvent.pointerDown(window);

    expect(close).toHaveBeenCalledWith(TOAST_ID);
  });

  it("does NOT close on a pointerdown targeting the toast root itself", async () => {
    setViewport("mobile");
    const close = vi.spyOn(cartToastManager, "close");
    const { getByTestId } = render(createElement(Harness));
    await flushFrame();

    fireEvent.pointerDown(getByTestId("inside-button"));

    expect(close).not.toHaveBeenCalled();
  });

  // The bug this guard exists for: the add control is what CREATES this toast,
  // so letting its `pointerdown` dismiss the toast first made Base UI's
  // `addToast` find an `ending` toast and tear it down for a fresh one —
  // replaying the entrance animation and resetting `updateKey`, which is
  // exactly the in-place update the dedupe is for.
  it("does NOT close on a pointerdown inside an add-to-cart control", async () => {
    setViewport("mobile");
    const close = vi.spyOn(cartToastManager, "close");
    const { getByTestId } = render(createElement(Harness));
    await flushFrame();

    // The span, not the button: a real tap lands on the label inside it.
    fireEvent.pointerDown(getByTestId("add-button").firstElementChild!);

    expect(close).not.toHaveBeenCalled();
  });

  it("does NOT attach any dismiss behaviour on a desktop viewport", async () => {
    setViewport("desktop");
    const close = vi.spyOn(cartToastManager, "close");
    render(createElement(Harness));
    await flushFrame();

    fireEvent.scroll(window);
    fireEvent.pointerDown(window);

    expect(close).not.toHaveBeenCalled();
  });

  it("removes its listeners on unmount", async () => {
    setViewport("mobile");
    const close = vi.spyOn(cartToastManager, "close");
    const { unmount } = render(createElement(Harness));
    await flushFrame();

    unmount();
    fireEvent.scroll(window);

    expect(close).not.toHaveBeenCalled();
  });
});
