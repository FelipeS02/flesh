import type { OptionAxis } from "@/modules/catalog/client";
import { sizesOf, type GarmentCut } from "../garment/cuts";

type SizeTableProps = {
  cut: GarmentCut;
  /** The product's size axis, or `null` when it is not sold by size. */
  sizeAxis: OptionAxis | null;
};

/**
 * The sizes this table gets a column for: the PATTERN's range, narrowed to what
 * the product is actually on sale in.
 *
 * The order is the pattern's, never the merchant's. A cut's measurements are
 * hand-authored smallest-first, and an axis whose values happen to arrive in
 * another order would otherwise reshuffle a table people read by scanning
 * left to right.
 *
 * With no size axis nothing constrains the range, so the pattern's own table
 * is the honest answer — filtering with no filter would empty it.
 */
export function sizeColumns(cut: GarmentCut, sizeAxis: OptionAxis | null): string[] {
  const sizes = sizesOf(cut);

  if (!sizeAxis) {
    return sizes;
  }

  const onSale = new Set(sizeAxis.values.map((value) => value.trim().toLowerCase()));

  return sizes.filter((size) => onSale.has(size.toLowerCase()));
}

/**
 * The garment's measurements, in centimetres, flat.
 *
 * A real `<table>` rather than the artboard's stack of rows: the artboard is
 * the source of truth for LAYOUT, and this markup draws the same grid — but a
 * number here only means something next to its measurement and its size, and
 * `<th scope>` is the only way a screen reader can pair them. The artboard
 * cannot express that; it is not a disagreement with it.
 */
export function SizeTable({ cut, sizeAxis }: SizeTableProps) {
  const columns = sizeColumns(cut, sizeAxis);

  return (
    <div className="flex w-full flex-col gap-5">
      <table className="w-full table-fixed border-collapse text-left font-sans">
        <thead>
          <tr>
            {/* The corner heads the measurement column, and a measurement name
                is not a size — so it is deliberately empty rather than
                labelled with a word the artboard never drew. */}
            <th scope="col" className="w-1/4 pb-3" />
            {columns.map((size) => (
              <th
                key={size}
                scope="col"
                className="pb-3 text-[9px] font-normal tracking-control text-muted-foreground md:text-[10px]"
              >
                {size}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {cut.measurements.map((measurement) => (
            <tr key={measurement.label} className="border-t border-border">
              <th
                scope="row"
                className="py-3.5 text-[9px] font-normal tracking-control text-muted-foreground md:text-[10px]"
              >
                {measurement.label}
              </th>
              {columns.map((size) => (
                <td
                  key={size}
                  className="py-3.5 text-xs tracking-control text-foreground md:text-[13px]"
                >
                  {measurement.bySize[size] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        Medidas en centímetros
      </p>
    </div>
  );
}
