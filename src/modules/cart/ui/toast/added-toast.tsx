"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Toast, type ToastObject } from "@base-ui/react/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/modules/catalog/client";
import { DiscountBadge } from "@/modules/storefront/discount-badge";
import { promoPriceView } from "@/modules/storefront/pricing";
import { indexCartCatalog } from "../../domain/catalog-projection";
import { useCartEnvironment, useCartState } from "../../state/cart-context";
import type { AddedToCartData } from "./manager";
import { useDismissOnInteraction } from "./use-dismiss-on-interaction";

type AddedToastProps = {
  toast: ToastObject<AddedToCartData>;
};

/**
 * How the two lines that change on a re-add announce that they changed.
 *
 * UPWARD (`slide-in-from-bottom-1`), which is the opposite of the entrance:
 * `Toast.Root` drops DOWN from the Cart Trigger when the toast first appears,
 * so a second downward motion would read as a second toast arriving — exactly
 * the impression the dedupe exists to avoid. Coming up says "this value went
 * up", which is literally what the quantity did.
 *
 * Faster than the entrance too (150ms against 200ms): the toast is already on
 * screen and being read, so the update has to catch the eye without asking to
 * be watched.
 */
const UPDATE_ANIMATION =
  "animate-in fade-in slide-in-from-bottom-1 duration-150 ease-out motion-reduce:animate-none";

/**
 * The toast's content. Resolves title, image, combination, price and
 * `compareAt` from the LIVE catalog index — the exact discipline
 * `ui/line-row.tsx` already follows — because the payload carries only
 * `{variantId, repeat}` (design D6): `VariantView` has no title or image for
 * `showAddedToCart` to have carried in the first place. Quantity is read
 * from `useCartState()` for the same reason: it must reflect whatever the
 * cart holds NOW, not the count at the moment this toast was first shown.
 */
export function AddedToast({ toast }: AddedToastProps) {
  const { catalog } = useCartEnvironment();
  const state = useCartState();
  const index = useMemo(() => indexCartCatalog(catalog), [catalog]);
  // Unconditional (React hook rules), even though it does nothing useful for
  // the `!entry || !data` early return below — a toast with no resolvable
  // display data has nothing on screen for a mobile interaction to dismiss.
  const rootRef = useDismissOnInteraction(toast.id);

  const data = toast.data;
  const entry = data ? index.get(data.variantId) : undefined;
  const quantity =
    state.status === "ready"
      ? (state.lines.find((line) => line.variantId === data?.variantId)?.quantity ?? 0)
      : 0;

  // Mirrors `LineRow`'s own guard: a variant `reconcile` has already dropped
  // from the catalog has nothing honest left to show.
  if (!entry || !data) {
    return null;
  }

  const { product, variant } = entry;
  const combination = variant.combination.join(", ");
  const price = promoPriceView(variant.price, variant.compareAt);

  // Base UI bumps `updateKey` every time `add()` lands on an id that already
  // exists — which is precisely our dedupe path — and leaves it at 0 for the
  // first one. Using it as a React `key` remounts just the two lines that
  // changed, which is what replays their animation; the thumbnail and title
  // are deliberately outside it, so the image never flickers and the eye is
  // drawn to what actually moved.
  //
  // Gated on `> 0` rather than applied always: on the first appearance these
  // lines would otherwise animate UP inside a toast that is animating DOWN,
  // and the two motions would fight in the same 200ms.
  const updateKey = toast.updateKey ?? 0;
  const changed = updateKey > 0 ? UPDATE_ANIMATION : undefined;

  return (
    // The gap between the status line and the body lives HERE, on the element
    // that actually stacks those two, rather than on `Toast.Root`. It sat
    // there as a `gap-2` for a while and did nothing at all: `Toast.Root` is
    // `relative`, not a flex or grid container, so the property had no box
    // model to apply to and the two rows rendered flush against each other.
    // 12 / 16 are the artboard's own figures, and they are checkable against
    // it: the component is 143 tall at 20 padding, its head 15 and its body
    // 72, and 143 - 40 - 87 leaves exactly the 16 this sets on desktop.
    <div ref={rootRef} className="flex flex-col gap-3 md:gap-4">
      <p
        key={`status-${updateKey}`}
        className={cn("font-sans text-xs tracking-control text-foreground", changed)}
      >
        {data.repeat ? "SUMASTE OTRA UNIDAD" : "AGREGADO AL CARRITO"}
      </p>
      <div className="flex items-start gap-3">
        {product.image && (
          <div className="relative h-18 w-15.5 content-center shrink-0 border overflow-hidden">
            <Image src={product.image} alt="" width={62} height={72} className="object-cover" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1">
          <p className="font-sans text-sm text-foreground">{product.title}</p>
          {combination && (
            <p className="font-sans text-xs text-muted-foreground">TALLE {combination}</p>
          )}
          <p
            key={`price-${updateKey}`}
            className={cn(
              "flex items-baseline gap-2 font-sans text-sm tabular-nums text-foreground",
              changed,
            )}
          >
            {quantity} x {formatMoney(price.current)}
            {price.previous && (
              <s className="text-xs text-muted-foreground">{formatMoney(price.previous)}</s>
            )}
            {price.percent !== null && <DiscountBadge percent={price.percent} />}
          </p>
        </div>
      </div>
      {/* Composed onto the design system's `Button` through Base UI's
          `render` prop — the same seam `SheetClose` already uses in
          `drawer.tsx` — so the one control inside the toast carries the same
          focus ring and press feedback as every other button in the app. */}
      <Toast.Close
        aria-label="Cerrar"
        className="absolute right-3 top-3"
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:bg-transparent hover:text-foreground"
          />
        }
      >
        ×
      </Toast.Close>
    </div>
  );
}
