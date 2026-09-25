"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  deriveAxisStates,
  formatMoney,
  type ColourwayLink,
  type GarmentSize,
  type Selection,
  type VariantMatrix,
  type VariantView,
} from "@/modules/catalog/client";
import { transferPrice } from "@/modules/storefront/pricing";
import { AxisSelector } from "./axis-selector";
import { ColourwaySwatches } from "./colourway-swatches";
import { widgetVisible } from "./widget-visibility";

/**
 * The sentinel the widget watches, and the reason it exists.
 *
 * An `IntersectionObserver` reports CROSSINGS of its root box. The panel is
 * taller than the half-viewport it is measured against, so it is already
 * intersecting before its top edge reaches the middle and still intersecting
 * after — the one moment the rule cares about produces no callback at all. A
 * zero-height marker at the panel's top edge crosses cleanly, exactly once,
 * in each direction.
 */
const PANEL_TOP_SELECTOR = "[data-pdp-panel-top]";

/**
 * Extends the observer's root a full viewport BELOW the fold.
 *
 * Without it the marker is outside the root while the panel is still below
 * the screen — which is the whole first screenful — and the widget would be
 * hidden exactly when it is most useful.
 */
const PANEL_TOP_ROOT_MARGIN = "-50% 0px 100% 0px";

type PurchaseWidgetProps = {
  product: VariantMatrix;
  selection: Selection;
  colourways: ColourwayLink[];
  currentSlug: string;
  /** The variant whose price is on the button — the selected one, or the default. */
  priced: VariantView | undefined;
  canAddToCart: boolean;
  ctaLabel: string;
  onSelect: (axisIndex: number, value: string) => void;
  onAdd?: () => void;
  /** See `PurchasePanelProps.sizeChart` — same optional pass-through, same reason it is not part of `VariantMatrix`. */
  sizeChart?: readonly GarmentSize[] | null;
};

/**
 * The mobile PDP's fixed purchase bar.
 *
 * It is a SHORTCUT, not a second source of truth: every control on it is the
 * same component the panel below draws, and the selection they both read
 * lives in the query string rather than in either of them. That is what makes
 * two live copies of the size boxes safe — there is no state here to fall out
 * of step with the panel, because there is no state here at all.
 *
 * Mobile only, by CSS. The desktop PDP puts the panel beside the gallery
 * where it is already in view, so there is nothing for a shortcut to shorten.
 */
export function PurchaseWidget({
  product,
  selection,
  colourways,
  currentSlug,
  priced,
  canAddToCart,
  ctaLabel,
  onSelect,
  onAdd,
  sizeChart,
}: PurchaseWidgetProps) {
  const visible = useWidgetVisible();
  const { axes } = product;

  return (
    <div
      data-purchase-widget
      data-visible={visible}
      // `inert` and not just `opacity-0`: a widget that has slid off the
      // bottom of the screen is still in the DOM, and without this its size
      // boxes stay tabbable and its button stays clickable from a keyboard
      // — you would be operating a control nobody can see.
      inert={!visible}
      // `|| undefined` so a visible widget carries no attribute at all
      // rather than `aria-hidden="false"`. The two mean the same thing, and
      // the one that says nothing is the one that cannot be misread.
      aria-hidden={!visible || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 border-t border-border bg-popover px-4 pt-3 pb-6 shadow-[0_-2px_24px_rgba(0,0,0,0.8)] md:hidden",
        "transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {axes.map((axis, index) => (
            <AxisSelector
              key={axis.label}
              compact
              axis={axis}
              values={deriveAxisStates(product, selection, index)}
              selected={selection[index] ?? null}
              onSelect={(value) => onSelect(index, value)}
              sizeChart={sizeChart}
            />
          ))}
        </div>

        {colourways.length > 0 && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="font-sans text-[9px] tracking-control text-muted-foreground">
              Color
            </p>
            <ColourwaySwatches compact links={colourways} currentSlug={currentSlug} />
          </div>
        )}
      </div>

      <button
        type="button"
        // See the panel's own add button: the toast's mobile dismiss hook
        // reads this so the tap that creates the toast cannot hide it.
        data-cart-add=""
        disabled={!canAddToCart}
        onClick={() => onAdd?.()}
        // Label left, price right. The price is the transfer price and only
        // the transfer price — the button is one line, and a line that tried
        // to carry both figures would have to explain which is which in a
        // space that has no room to explain anything.
        className="flex h-12 w-full items-center justify-between bg-primary px-4 font-display text-lg text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
      >
        <span>{ctaLabel}</span>
        {priced && <span className="tabular-nums">{formatMoney(transferPrice(priced.price))}</span>}
      </button>
    </div>
  );
}

/**
 * Tracks whether the panel below has taken over the screen.
 *
 * The marker is found by selector rather than handed down as a ref because
 * it is rendered by the SERVER component that owns the page's column, and a
 * ref does not cross that boundary. The attribute is the contract between
 * them.
 */
function useWidgetVisible(): boolean {
  // Starts visible: at the top of a PDP the panel is always below the fold,
  // and opening with the widget hidden would flash it in on the first frame
  // after the observer reports what was true all along.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const marker = document.querySelector(PANEL_TOP_SELECTOR);

    if (!marker) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);

        if (!entry) return;

        // Read the GEOMETRY rather than `isIntersecting`: the root margin
        // above exists to make the callback fire at the right moment, not to
        // encode the rule. The rule is one comparison, and it lives in
        // `widgetVisible` where it can be proven.
        setVisible(widgetVisible(entry.boundingClientRect.top, window.innerHeight));
      },
      { rootMargin: PANEL_TOP_ROOT_MARGIN },
    );

    observer.observe(marker);

    return () => observer.disconnect();
  }, []);

  return visible;
}
