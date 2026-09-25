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
   * The size-guide modal already prints "Medidas en centímetros" as its own
   * description, right above this table — repeating it in the table's own
   * footer would put the same sentence on screen twice. The accordion, which
   * has no description slot of its own, keeps the footer by leaving this
   * unset.
   */
  hideCaption?: boolean;
};

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
                className={cn(
                  "pb-3 text-[9px] font-normal tracking-control md:text-[10px]",
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
            <th scope="row" className="py-3.5 text-[9px] font-normal tracking-control text-muted-foreground md:text-[10px">{measurementLabels[key]}</th>
            {sizeChart.map(({ size, measurements }) => <td key={size} className="py-3.5 text-xs tracking-control text-foreground md:text-[13px]">{measurements[key] ?? "—"}</td>)}
          </tr>)}
        </tbody>
      </table>
      {!hideCaption && (
        <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">Medidas en centímetros</p>
      )}
    </div>
  );
}
