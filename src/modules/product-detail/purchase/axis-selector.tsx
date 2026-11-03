"use client";

import { cn } from "@/lib/utils";
import {
  axisMatchesSizeChart,
  hasSizeChartMeasurements,
  type AxisValueView,
  type GarmentSize,
  type OptionAxis,
} from "@/modules/catalog/client";
import { SizeGuide } from "./size-guide";

type AxisSelectorProps = {
  axis: OptionAxis;
  values: AxisValueView[];
  selected: string | null;
  onSelect: (value: string) => void;
  /** The widget's cramped variant: smaller boxes, no standalone label row. */
  compact?: boolean;
  /**
   * Passed to every axis, not just the size one — this component, not the
   * caller, decides whether IT is the size axis (see `axisMatchesSizeChart`),
   * so a caller never has to know which index that is.
   */
  sizeChart?: readonly GarmentSize[] | null;
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
  sizeChart,
}: AxisSelectorProps) {
  const showSizeGuide = !!sizeChart && hasSizeChartMeasurements(sizeChart) && axisMatchesSizeChart(axis.values, sizeChart);

  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      <p
        className={cn(
          "flex items-center gap-2 font-sans tracking-control",
          // Non-compact grows to `justify-between` so the trigger lands on
          // the RIGHT of the row — harmless with one child when there is no
          // trigger to show.
          compact ? "text-[9px]" : "justify-between text-[11px] md:text-[13px]",
        )}
      >
        {/* The widget has room for the axis name and nothing else; the panel
            can afford the verb. */}
        <span>{compact ? axis.label : `Seleccionar ${axis.label}`}</span>
        {showSizeGuide && (
          <SizeGuide sizeChart={sizeChart} highlightSize={selected} compact={compact} />
        )}
      </p>

      <div
        role="group"
        aria-label={axis.label}
        className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5")}
      >
        {values.map(({ value, state }) => (
          <AxisOption
            key={value}
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
  value: string;
  state: AxisValueView["state"];
  isSelected: boolean;
  onSelect: (value: string) => void;
  compact?: boolean;
};

function AxisOption({
  value,
  state,
  isSelected,
  onSelect,
  compact,
}: AxisOptionProps) {
  // Only a combination that was never offered is unselectable. A sold-out one
  // used to be disabled too, and that made the restock form unreachable:
  // shoppers could not click the size they wanted to be told about. It now
  // looks and behaves like any other value; the CTA ("Sin stock") and the
  // restock form say the rest once it is chosen.
  const isDisabled = state === "nonexistent";
  // Sighted shoppers get no cue here by design, so the fact moves to a
  // description: it adds to the name ("L") instead of replacing it, and
  // changes nothing visually.
  const description = state === "soldOut" ? "Sin stock" : undefined;

  return (
    // aria-description is ARIA 1.3; the lint rule's attribute table predates
    // it and flags a valid attribute. An aria-describedby sibling would need a
    // hidden node per option for the same result.
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <button
      type="button"
      aria-pressed={isSelected}
      aria-description={description}
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
        // An option can be selected AND nonexistent at once — a shared link
        // carries a combination that was never offered. The filled
        // "selected" treatment is reserved for a real choice; a nonexistent
        // one keeps the muted box and marks the selection with a ring
        // instead, so it never reads as a live choice.
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
