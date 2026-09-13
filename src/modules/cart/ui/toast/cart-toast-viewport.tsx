"use client";

import { Toast } from "@base-ui/react/toast";
import { AddedToast } from "./added-toast";
import { cartToastManager } from "./manager";

type CartToastViewportProps = {
  /**
   * `Element | null` from STATE, never a `useRef` object — `ToastPositioner`
   * narrows with `isElement(anchorProp) ? anchorProp : null`
   * (`@base-ui/react/toast/positioner/ToastPositioner.js:55`) BEFORE it ever
   * reaches the generic ref-unwrapping path, so a ref object silently
   * becomes `null` here. See `components/shared/header.tsx`'s callback ref.
   */
  anchor: Element | null;
};

/**
 * Anatomy: `Toast.Provider > Portal > Viewport > Positioner(anchor) > Root`.
 *
 * Rendered by `Header`, and ONLY while the cart drawer is closed (design
 * D3): unmounting this component is the entire suppression mechanism, since
 * `createToastManager()` holds no toast state of its own — with no provider
 * mounted, `showAddedToCart` emits into an empty listener set and the event
 * is simply dropped, no store entry and no timer created.
 *
 * `toastManager={cartToastManager}` is what lets the PDP's add site reach
 * this provider's store from a MODULE-scope function call, with no React
 * context threaded between them.
 */
export function CartToastViewport({ anchor }: CartToastViewportProps) {
  return (
    <Toast.Provider toastManager={cartToastManager}>
      <ToastList anchor={anchor} />
    </Toast.Provider>
  );
}

function ToastList({ anchor }: CartToastViewportProps) {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      {/* `Toast.Viewport` is what renders `role="region"` + `aria-live="polite"`
          (`viewport/ToastViewport.js:186-187`) — the polite announcement the
          a11y requirement asks for. `Toast.Root` itself renders
          `role="dialog"`, never `role="status"` — Base UI does not offer that
          role for a toast, so the requirement's literal wording is
          unsatisfiable and the polite region is the actual mechanism. */}
      <Toast.Viewport>
        {toasts.map((toast) => (
          // NEVER render an anchorless positioner: with no real anchor,
          // Floating UI never positions it and it renders at `opacity: 0`
          // (`internals/useAnchorPositioning.js:373-374`) — invisible, not
          // statically placed. The Cart Trigger is the one anchor present at
          // every viewport width (design D5), so it is used unconditionally.
          <Toast.Positioner
            key={toast.id}
            toast={toast}
            anchor={anchor}
            side="bottom"
            align="end"
            collisionPadding={20}
            className="z-50"
          >
            {/* The entry animation needs no state selector. `animate-in` sets
                `animation` unconditionally, and Base UI MOUNTS this node when
                the toast appears — so the keyframe runs once, on mount, and
                never again. That is also why a re-add does not replay it: the
                dedupe updates this toast in place rather than remounting it,
                which is the behaviour we want. The status line changing to
                "SUMASTE OTRA UNIDAD" is the feedback there, not a second
                entrance.

                It drops DOWNWARD from its anchor (`slide-in-from-top-2`, 8px)
                because the thing it is announcing came from the Cart Trigger
                directly above it. Sliding from anywhere else would describe a
                journey the toast did not make. No zoom: the box is hard-edged
                and bordered, and scaling it reads as "popped" rather than
                "dropped".

                `motion-reduce:animate-none` is not decoration. This toast is
                announced politely to assistive technology and must not insist
                on movement for anyone who asked the OS for less of it. */}
            <Toast.Root
              toast={toast}
              className="relative w-[min(350px,100vw-40px)] border border-border bg-background p-3.5 shadow-lg duration-200 ease-out animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none md:p-5"
            >
              <AddedToast toast={toast} />
            </Toast.Root>
          </Toast.Positioner>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
