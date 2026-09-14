"use client";

import { useMemo, type ReactNode } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import {
  deriveAxisStates,
  purchaseLimit,
  resolveVariant,
  type ColourwayLink,
  type Selection,
  type VariantMatrix,
  type VariantView,
} from "@/modules/catalog/client";
import { showAddedToCart, useCartDispatch, useCartState } from "@/modules/cart";
import { AxisSelector } from "./axis-selector";
import { axisParamKeys, paramValue, selectionFromQuery } from "./axis-params";
import { PriceBlock } from "./price-block";
import { PurchaseWidget } from "./purchase-widget";
import BarbedWireSeparator from '@/components/shared/barbed-wire-separator';

type PurchasePanelProps = {
  /** Domain identity needed by the cart reducer; plain RSC-safe data. */
  productId: number;
  /** Server-rendered colourway navigation inserted into the desktop sequence. */
  colourwaySelector: ReactNode;
  /** The colour row, repeated on the mobile widget. */
  colourways: ColourwayLink[];
  currentSlug: string;
  /**
   * Only the axes and variants — never the whole `ProductView`. The panel is a
   * client component, so everything it takes crosses the RSC boundary as
   * serialised props, and `descriptionHtml` is already being sent once for the
   * page's own copy of it.
   */
  product: VariantMatrix;
  defaultVariantId: number;
};

/**
 * The buying half of the PDP: price, one selector per variant axis, and the
 * add-to-cart control.
 *
 * The selection lives in the QUERY STRING rather than in component state, so a
 * chosen colourway survives a reload and can be linked to — which is also what
 * lets a catalogue card open the PDP with a variant already picked. Writes stay
 * `shallow` (nuqs' default): choosing a size is a client-side change and must
 * not round-trip to the server.
 */
export function PurchasePanel({
  product,
  productId,
  defaultVariantId,
  colourwaySelector,
  colourways,
  currentSlug,
}: PurchasePanelProps) {
  const { axes } = product;
  const dispatch = useCartDispatch();
  const state = useCartState();

  // Keyed by axis label, so a product with axes we have never seen still gets
  // readable params. Memoised because `useQueryStates` treats the key map as
  // the identity of what it is subscribed to.
  const keys = useMemo(() => axisParamKeys(axes), [axes]);
  const keyMap = useMemo(
    () => Object.fromEntries(keys.map((key) => [key, parseAsString])),
    [keys],
  );
  const [query, setQuery] = useQueryStates(keyMap);

  return (
    <PanelView
      product={product}
      productId={productId}
      defaultVariantId={defaultVariantId}
      colourwaySelector={colourwaySelector}
      colourways={colourways}
      currentSlug={currentSlug}
      query={query}
      // Read here, where `state` already exists, rather than inside `PanelView`
      // — the fallback below renders `PanelView` with no `CartProvider` at all
      // (it runs during the static build), so the held-quantity lookup has to
      // live on the side that actually has a cart to ask.
      heldQuantity={(variantId) =>
        state.status === "ready"
          ? (state.lines.find((line) => line.variantId === variantId)?.quantity ?? 0)
          : 0
      }
      onSelect={(index, value) => setQuery({ [keys[index]!]: paramValue(value) })}
      onAdd={(variant) => {
        // Computed BEFORE the dispatch below — this is the only place the
        // "was this variant already in the cart" fact exists unambiguously
        // (design D6); reading it after would always see the line this same
        // dispatch is about to create or increment.
        const repeat =
          state.status === "ready" && state.lines.some((line) => line.variantId === variant.id);

        dispatch({
          type: "add",
          productId,
          variantId: variant.id,
          price: variant.price,
          limit: purchaseLimit(variant),
        });
        showAddedToCart({ variantId: variant.id, repeat });
      }}
    />
  );
}

/**
 * The panel as the STATIC build can render it: no query, so every axis shows
 * the default variant and the price is real HTML rather than a placeholder.
 *
 * This exists because `generateStaticParams` prerenders the PDP, and reading
 * the query string during a prerender is a CSR bailout — Next requires the
 * reader to sit inside a `<Suspense>`. What goes in that boundary's fallback
 * is a design decision, not a formality: a skeleton would take the price out
 * of the prerendered HTML, on the one page whose price is the point. The
 * default selection is the honest answer, and it is also the one the canonical
 * URL describes.
 *
 * Selecting does nothing until the real panel hydrates over it, which is the
 * same fraction of a second any client component is inert for.
 */
export function PurchasePanelFallback({
  product,
  productId,
  defaultVariantId,
  colourwaySelector,
  colourways,
  currentSlug,
}: PurchasePanelProps) {
  return (
    <PanelView
      product={product}
      productId={productId}
      defaultVariantId={defaultVariantId}
      colourwaySelector={colourwaySelector}
      colourways={colourways}
      currentSlug={currentSlug}
      query={{}}
      onSelect={() => {}}
    />
  );
}

type PanelViewProps = PurchasePanelProps & {
  query: Readonly<Record<string, string | null | undefined>>;
  onSelect: (axisIndex: number, value: string) => void;
  onAdd?: (variant: VariantView) => void;
  /**
   * How many units of a given variant the cart already holds. Defaults to
   * always-zero for the fallback, which never has a `CartProvider` to ask —
   * it renders during the static build, before any cart exists at all.
   */
  heldQuantity?: (variantId: number) => number;
};

/** Everything the panel draws, given a selection somebody else read. */
function PanelView({
  product,
  defaultVariantId,
  colourwaySelector,
  colourways,
  currentSlug,
  query,
  onSelect,
  onAdd,
  heldQuantity,
}: PanelViewProps) {
  const { axes, variants } = product;
  const keys = axisParamKeys(axes);

  const defaultVariant =
    variants.find((variant) => variant.id === defaultVariantId) ?? variants[0];

  // An axis the URL says nothing about falls back to the default variant's
  // value, so the panel opens on a complete, priced selection instead of an
  // empty one — and the clean URL stays the canonical one.
  const fromQuery = selectionFromQuery(axes, query);
  const selection: Selection = axes.map(
    (_, index) => fromQuery[index] ?? defaultVariant?.combination[index] ?? null,
  );

  const selected = resolveVariant(product, selection);
  const priced = selected ?? defaultVariant;
  const limit = selected ? purchaseLimit(selected) : null;
  // The fallback never has a cart to ask (see `heldQuantity`'s own comment),
  // so it reads zero held — which is also the honest pre-hydration truth.
  const held = selected ? (heldQuantity?.(selected.id) ?? 0) : 0;
  const atLimit = limit !== null && held >= limit;
  const canAddToCart = selected?.inStock === true && !atLimit;

  // Four different facts deserve four different sentences. A dead button
  // reading "Agregar al carrito" tells you the site is broken; "Sin stock"
  // tells you the garment is gone; "Máximo disponible" tells you it is the
  // CART, not the catalog, that is full — a shopper who already holds every
  // unit the merchant has needs a different sentence than one who never
  // could have gotten one.
  const ctaLabel = !selected
    ? "No disponible"
    : !selected.inStock
      ? "Sin stock"
      : atLimit
        ? "Máximo disponible"
        : "Agregar al carrito";

  return (
    <>
      <div data-purchase-panel className="flex w-full flex-col gap-5">
        {priced && <PriceBlock variant={priced} />}

      {/* <hr className="border-border" /> */}
      <BarbedWireSeparator className='-mt-2 -mb-1 opacity-40'/>
      

      {colourwaySelector}

      {axes.map((axis, index) => (
        <AxisSelector
          key={keys[index]}
          axis={axis}
          values={deriveAxisStates(product, selection, index)}
          selected={selection[index] ?? null}
          onSelect={(value) => onSelect(index, value)}
        />
      ))}

      <button
        type="button"
        // Read by the toast's mobile dismiss-on-interaction hook, which must
        // not treat the tap that CREATES the toast as one that hides it —
        // see `cart/ui/toast/use-dismiss-on-interaction.ts`.
        data-cart-add=""
        disabled={!canAddToCart}
        onClick={() => selected && onAdd?.(selected)}
        // Height, not decoration: 48px on mobile / 56px on desktop is the
        // usual band for a primary e-commerce CTA — comfortably over the
        // 44px touch-target floor (WCAG 2.1 AAA 2.5.5, Apple HIG) and over
        // Material 3's 48dp baseline, without the 56/64 it carried before,
        // which reads as a hero block rather than a button.
        //
        // The artboard turns the whole block muted rather than fading the red:
        // red at 40% is still red, and a washed-out version of the one control
        // you are meant to press reads as a rendering fault rather than a
        // deliberate state.
        className="h-12 w-full bg-primary font-display text-lg text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:h-14 md:text-xl"
      >
        {ctaLabel}
      </button>

      </div>

      {/* The mobile shortcut. It renders from THIS component, which already
          resolved the variant, rather than from the page beside it:
          everything it shows — which sizes are buyable, which one is chosen,
          what the button says, what it costs — is derived above, and deriving
          it a second time somewhere else is how two controls for one choice
          start disagreeing.

          It is a SIBLING of the panel rather than a child. `position: fixed`
          makes its DOM position irrelevant to where it lands on screen, and
          keeping it out of the panel's box is what lets the panel still be
          addressed as one thing — by a test, or by anything else that needs
          "the panel" to mean the panel and not the panel plus its echo. */}
      <PurchaseWidget
        product={product}
        selection={selection}
        colourways={colourways}
        currentSlug={currentSlug}
        priced={priced}
        canAddToCart={canAddToCart}
        ctaLabel={ctaLabel}
        onSelect={onSelect}
        onAdd={() => selected && onAdd?.(selected)}
      />
    </>
  );
}
