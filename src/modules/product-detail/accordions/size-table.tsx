import { cn } from "@/lib/utils";
import {
  measurementKeys,
  normalizeGarmentSize,
  type GarmentSize,
  type MeasurementKey,
} from "@/modules/catalog/client";

type SizeTableProps = {
  sizeChart: readonly GarmentSize[];
  /** The shopper's current pick on the matching axis; highlights that column. */
  highlightSize?: string;
  /**
   * The size-guide modal already prints `sizeChartNote` as its own
   * description, right above this table — repeating it in the table's own
   * footer would put the same copy on screen twice. The accordion, which
   * has no description slot of its own, keeps the footer by leaving this
   * unset.
   */
  hideCaption?: boolean;
};

/**
 * Shared by this table's footer and the size-guide modal's description so the
 * two surfaces cannot drift apart. One line each: the second is advice, not
 * part of the measurement disclaimer.
 */
export const sizeChartNote = [
  "Medidas en CM. Los talles pueden variar 1/2 cm.",
  "Si estás entre dos talles, recomendamos el más grande.",
] as const;

export function SizeChartNote() {
  return sizeChartNote.map((line) => (
    <span key={line} className="block">
      {line}
    </span>
  ));
}

const measurementLabels: Record<MeasurementKey, string> = {
  back_width: "Ancho de espalda",
  chest_width: "Ancho de pecho",
  waist_width: "Ancho de cintura",
  garment_length: "Largo de prenda",
  sleeve_length: "Largo de manga",
  front_rise: "Tiro delantero",
  leg_opening: "Abertura de pierna",
};

export function SizeTable({ sizeChart, highlightSize, hideCaption }: SizeTableProps) {
  const rows = measurementKeys.filter((key) =>
    sizeChart.some((size) => size.measurements[key] !== undefined),
  );
  if (sizeChart.length === 0 || rows.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <table className="w-full table-fixed border-collapse text-left font-sans">
        <thead><tr><th scope="col" className="w-1/4 pb-3" />
          {sizeChart.map(({ size }) => {
            // Compared normalized, same as `selectSizeChart`/`axisMatchesSizeChart` —
            // the axis value and the chart's own size string can differ in
            // case or stray whitespace without being a different size.
            const isCurrent =
              highlightSize !== undefined &&
              normalizeGarmentSize(size) === normalizeGarmentSize(highlightSize);
            return (
              <th
                key={size}
                scope="col"
                aria-current={isCurrent ? true : undefined}
                // Centred, as are the value cells below: left-aligned, a
                // one-letter "M" and a two-digit "56" start on the same edge
                // but never share an axis, so the size reads as off its column.
                className={cn(
                  "pb-3 text-center text-[11px] font-normal tracking-control md:text-[13px]",
                  isCurrent ? "text-primary" : "text-muted-foreground",
                )}
              >
                {size}
              </th>
            );
          })}
        </tr></thead>
        <tbody>
          {rows.map((key) => <tr key={key} className="border-t border-border">
            <th scope="row" className="py-3.5 text-[11px] font-normal tracking-control text-muted-foreground md:text-[13px]">{measurementLabels[key]}</th>
            {sizeChart.map(({ size, measurements }) => <td key={size} className="py-3.5 text-center text-xs tracking-control text-foreground md:text-[13px]">{measurements[key] ?? "—"}</td>)}
          </tr>)}
        </tbody>
      </table>
      {!hideCaption && (
        <p className="font-sans text-[11px] tracking-control text-muted-foreground md:text-[13px]"><SizeChartNote /></p>
      )}
    </div>
  );
}
