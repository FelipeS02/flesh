"use client";

import { cn } from "@/lib/utils";
import type { AxisValueView, OptionAxis } from "@/modules/catalog/client";

type AxisSelectorProps = {
  axis: OptionAxis;
  values: AxisValueView[];
  selected: string | null;
  onSelect: (value: string) => void;
  /** The widget's cramped variant: smaller boxes, no standalone label row. */
  compact?: boolean;
};

/**
 * One axis, drawn as labelled boxes.
 *
 * There is no colour-dot branch here, and that is a consequence of the
 * catalogue's shape rather than a styling choice: colours are separate
 * products, so an axis on a product is a size, a length, a cut — something
 * whose value is a word worth printing. The colour choice lives in
 * `ColourwaySelector`, which navigates instead of setting state.
 *
 * This lives in its own module because the PDP now draws it TWICE: once in
 * the panel and once in the fixed widget over the gallery. Two copies of the
 * markup would be two places to change a size box, and the pair would drift
 * the first time only one of them was updated.
 */
export function AxisSelector({
  axis,
  values,
  selected,
  onSelect,
  compact,
}: AxisSelectorProps) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
      <p
        className={cn(
          "flex items-center gap-2 font-sans tracking-control text-muted-foreground",
          compact ? "text-[9px]" : "text-[9px] md:text-[10px]",
        )}
      >
        {/* The widget has room for the axis name and nothing else; the panel
            can afford the verb. */}
        <span>{compact ? axis.label : `Seleccionar ${axis.label}`}</span>
      </p>

      <div
        role="group"
        aria-label={axis.label}
        className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5")}
      >
        {values.map(({ value, state }) => (
          <AxisOption
            key={value}
            axisLabel={axis.label}
            value={value}
            state={state}
            isSelected={value === selected}
            onSelect={onSelect}
            compact={compact}
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
  compact?: boolean;
};

function AxisOption({
  axisLabel,
  value,
  state,
  isSelected,
  onSelect,
  compact,
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
        // 44px square: the touch-target floor Apple, NN/g and WCAG 2.1 AAA
        // all land on, and no larger — a size box is one of eight controls
        // in a row, so every extra pixel is paid for eight times over.
        //
        // The widget's 36px is BELOW that floor, and it is a deliberate
        // trade: the widget is a shortcut that sits over the photograph, the
        // full-size control is always a scroll away, and buying back those
        // 8px costs the garment more of the screen than the shortcut is
        // worth. The row is also spaced, so the boxes are not neighbours
        // anyone lands on by mistake.
        "font-sans transition-colors",
        compact ? "size-9 text-xs" : "size-11 text-sm md:text-base",
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
