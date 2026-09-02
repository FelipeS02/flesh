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
import { swatchColor } from "@/modules/storefront/swatches";
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
  const { axes, variants } = product;

  // Keyed by axis label, so a product with axes we have never seen still gets
  // readable params. Memoised because `useQueryStates` treats the key map as
  // the identity of what it is subscribed to.
  const keys = useMemo(() => axisParamKeys(axes), [axes]);
  const keyMap = useMemo(
    () => Object.fromEntries(keys.map((key) => [key, parseAsString])),
    [keys],
  );
  const [query, setQuery] = useQueryStates(keyMap);

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
          onSelect={(value) => setQuery({ [keys[index]!]: paramValue(value) })}
        />
      ))}

      {/* Deliberately inert: this slice ships the panel, and the cart it feeds
          is a separate change. It stays a real, focusable button so the
          keyboard and screen-reader path is built and tested now rather than
          bolted on later. */}
      <button
        type="button"
        disabled={!canAddToCart}
        className="h-14 w-full bg-primary font-display text-2xl text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 md:h-16 md:text-3xl"
      >
        Agregar al carrito
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
 * One axis. Whether it draws as colour dots or as labelled boxes is decided by
 * the VALUES, never by the axis label: the label is merchant-typed free text,
 * so keying off it would be a hardcoded axis name in disguise.
 */
function AxisSelector({ axis, values, selected, onSelect }: AxisSelectorProps) {
  const asSwatches =
    values.length > 0 && values.every(({ value }) => swatchColor(value) !== null);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 font-sans text-[11px] tracking-control text-muted-foreground md:text-[13px]">
        <span>Seleccionar {axis.label}</span>
        {/* A dot cannot say its own name, so the swatch axis prints the chosen
            value beside its label. A box already shows the value it carries. */}
        {asSwatches && selected && (
          <span className="text-foreground">{selected}</span>
        )}
      </p>

      <div role="group" aria-label={axis.label} className="flex items-center gap-2.5">
        {values.map(({ value, state }) => (
          <AxisOption
            key={value}
            axisLabel={axis.label}
            value={value}
            state={state}
            isSelected={value === selected}
            asSwatch={asSwatches}
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
  asSwatch: boolean;
  onSelect: (value: string) => void;
};

function AxisOption({
  axisLabel,
  value,
  state,
  isSelected,
  asSwatch,
  onSelect,
}: AxisOptionProps) {
  // Both unbuyable states are unselectable, but only one of them is worth
  // explaining: "sold out" is a fact about this drop, while a combination that
  // was never offered has nothing to announce beyond being unavailable.
  const isDisabled = state !== "available";
  const label = state === "soldOut" ? `${axisLabel} ${value} — agotado` : undefined;

  if (asSwatch) {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={label}
        disabled={isDisabled}
        onClick={() => onSelect(value)}
        className={cn(
          "flex size-12.5 items-center justify-center rounded-full",
          isSelected && "ring-1 ring-inset ring-foreground",
          isDisabled && "opacity-40",
        )}
      >
        <span
          className="block size-10 rounded-full border border-border"
          style={{ backgroundColor: swatchColor(value) ?? undefined }}
        />
        <span className="sr-only">{value}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={label}
      disabled={isDisabled}
      onClick={() => onSelect(value)}
      className={cn(
        "size-13 font-sans text-lg transition-colors md:text-xl",
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
