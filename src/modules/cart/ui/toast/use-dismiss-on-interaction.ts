import { useEffect, useRef, type RefObject } from "react";
import { cartToastManager } from "./manager";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * The one interaction that must never dismiss this toast: the control that
 * CREATES it. Add sites carry `data-cart-add` (`purchase-panel.tsx`,
 * `purchase-widget.tsx`).
 *
 * Without this, a second tap on Agregar al carrito dismissed the live toast
 * on `pointerdown` and only then ran its `click` handler — so
 * `showAddedToCart` met a toast already marked `ending`, and Base UI's
 * `addToast` removes an ending toast and builds a fresh one rather than
 * updating it (`toast/store.js:126-130`). The dedupe's whole point — one
 * toast updating in place — silently became "tear down and re-enter",
 * replaying the entrance animation and resetting `updateKey` to 0 so the
 * status and price lines stopped animating their change. Invisible on
 * desktop, where this hook does nothing at all.
 */
const ADD_TRIGGER_SELECTOR = "[data-cart-add]";

/**
 * "Any interaction hides the toast" — but only on mobile (design D8; desktop
 * is exempt by decision). Lives INSIDE `AddedToast`, not the viewport, so its
 * lifetime is exactly one toast's lifetime rather than the viewport's.
 *
 * Returns a ref the caller attaches to its own root element. Events whose
 * target falls inside that element are ignored, which is what lets Base
 * UI's own swipe-to-dismiss gesture (`swipeDirection`, default
 * `['down','right']`) run instead of being cut short by the very first
 * `pointerdown` that started the swipe.
 */
export function useDismissOnInteraction(toastId: string): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!window.matchMedia(MOBILE_QUERY).matches) {
      return;
    }

    let fired = false;
    let teardown: (() => void) | undefined;

    // Deferred a frame so the very click/tap that CREATED this toast — a
    // `pointerdown` on the header's cart trigger, say — cannot immediately
    // dismiss it.
    const frame = requestAnimationFrame(() => {
      const dismiss = (event: Event) => {
        if (fired) {
          return;
        }

        const target = event.target;
        if (target instanceof Node && rootRef.current?.contains(target)) {
          return;
        }

        // `closest`, not an equality check: a tap lands on whatever label or
        // icon the button wraps, never on the button element itself.
        const element =
          target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        if (element?.closest(ADD_TRIGGER_SELECTOR)) {
          return;
        }

        fired = true;
        cartToastManager.close(toastId);
      };

      const options: AddEventListenerOptions = { capture: true, passive: true };
      window.addEventListener("scroll", dismiss, options);
      window.addEventListener("pointerdown", dismiss, options);

      teardown = () => {
        window.removeEventListener("scroll", dismiss, { capture: true });
        window.removeEventListener("pointerdown", dismiss, { capture: true });
      };
    });

    return () => {
      cancelAnimationFrame(frame);
      teardown?.();
    };
  }, [toastId]);

  return rootRef;
}
