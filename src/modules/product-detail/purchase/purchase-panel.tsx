"use client";

import { useMemo } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { cn } from "@/lib/utils";
import {
  deriveAxisStates,
  resolveVariant,
  type AxisValueView,
  type OptionAxis,
  type Selection,
  type VariantMatrix,
} from "@/modules/catalog/client";
import { axisParamKeys, paramValue, selectionFromQuery } from "./axis-params";
import { PriceBlock } from "./price-block";

type PurchasePanelProps = {
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
export function PurchasePanel({ product, defaultVariantId }: PurchasePanelProps) {
  const { axes } = product;

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
      defaultVariantId={defaultVariantId}
      query={query}
      onSelect={(index, value) => setQuery({ [keys[index]!]: paramValue(value) })}
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
  defaultVariantId,
}: PurchasePanelProps) {
  return (
    <PanelView
      product={product}
      defaultVariantId={defaultVariantId}
      query={{}}
      onSelect={() => {}}
    />
  );
}

type PanelViewProps = PurchasePanelProps & {
  query: Readonly<Record<string, string | null | undefined>>;
  onSelect: (axisIndex: number, value: string) => void;
};

/** Everything the panel draws, given a selection somebody else read. */
function PanelView({ product, defaultVariantId, query, onSelect }: PanelViewProps) {
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
  const canAddToCart = selected?.inStock === true;

  // Three different facts deserve three different sentences. A dead button
  // reading "Agregar al carrito" tells you the site is broken; one reading
  // "Sin stock" tells you the garment is gone, which is the truth and is also
  // what makes the disabled state make sense.
  const ctaLabel = !selected
    ? "No disponible"
    : selected.inStock
      ? "Agregar al carrito"
      : "Sin stock";

  return (
    <div className="flex w-full flex-col gap-5">
      {priced && <PriceBlock variant={priced} />}

      <hr className="border-border" />

      {axes.map((axis, index) => (
        <AxisSelector
          key={keys[index]}
          axis={axis}
          values={deriveAxisStates(product, selection, index)}
          selected={selection[index] ?? null}
          onSelect={(value) => onSelect(index, value)}
        />
      ))}

      {/* Deliberately inert: this slice ships the panel, and the cart it feeds
          is a separate change. It stays a real, focusable button so the
          keyboard and screen-reader path is built and tested now rather than
          bolted on later. */}
      <button
        type="button"
        disabled={!canAddToCart}
        // The artboard turns the whole block muted rather than fading the red:
        // red at 40% is still red, and a washed-out version of the one control
        // you are meant to press reads as a rendering fault rather than a
        // deliberate state.
        className="h-14 w-full bg-primary font-display text-xl text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:h-16 md:text-2xl"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

type AxisSelectorProps = {
  axis: OptionAxis;
  values: AxisValueView[];
  selected: string | null;
  onSelect: (value: string) => void;
};

/**
 * One axis, drawn as labelled boxes.
 *
 * There is no colour-dot branch here any more, and that is a consequence of
 * the catalogue's shape rather than a styling choice: colours are separate
 * products, so an axis on a product is a size, a length, a cut — something
 * whose value is a word worth printing. The colour choice lives in
 * `ColourwaySelector`, which navigates instead of setting state.
 */
function AxisSelector({ axis, values, selected, onSelect }: AxisSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        <span>Seleccionar {axis.label}</span>
      </p>

      <div role="group" aria-label={axis.label} className="flex items-center gap-2.5">
        {values.map(({ value, state }) => (
          <AxisOption
            key={value}
            axisLabel={axis.label}
            value={value}
            state={state}
            isSelected={value === selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

type AxisOptionProps = {
  axisLabel: string;
  value: string;
  state: AxisValueView["state"];
  isSelected: boolean;
  onSelect: (value: string) => void;
};

function AxisOption({
  axisLabel,
  value,
  state,
  isSelected,
  onSelect,
}: AxisOptionProps) {
  // Both unbuyable states are unselectable, but only one of them is worth
  // explaining: "sold out" is a fact about this drop, while a combination that
  // was never offered has nothing to announce beyond being unavailable.
  const isDisabled = state !== "available";
  const label = state === "soldOut" ? `${axisLabel} ${value} — agotado` : undefined;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={label}
      disabled={isDisabled}
      onClick={() => onSelect(value)}
      className={cn(
        "size-13 font-sans text-sm transition-colors md:text-base",
        // An option can be selected AND unbuyable at once — a shared link
        // carries a combination that has since sold out. The filled
        // "selected" treatment is reserved for something you can actually
        // buy; an unbuyable one keeps the muted box and marks the selection
        // with a ring instead, so it never reads as a live choice.
        isDisabled
          ? "bg-muted text-muted-foreground line-through opacity-60"
          : isSelected
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-neutral-300",
        isDisabled && isSelected && "ring-1 ring-inset ring-muted-foreground",
      )}
    >
      {value}
    </button>
  );
}
