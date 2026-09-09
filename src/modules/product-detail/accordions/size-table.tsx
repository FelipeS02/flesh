import {
  measurementKeys,
  type GarmentSize,
  type MeasurementKey,
} from "@/modules/catalog/client";

type SizeTableProps = { sizeChart: readonly GarmentSize[] };

const measurementLabels: Record<MeasurementKey, string> = {
  back_width: "Ancho de espalda",
  chest_width: "Ancho de pecho",
  waist_width: "Ancho de cintura",
  garment_length: "Largo de prenda",
  sleeve_length: "Largo de manga",
  front_rise: "Tiro delantero",
  leg_opening: "Abertura de pierna",
};

export function SizeTable({ sizeChart }: SizeTableProps) {
  const rows = measurementKeys.filter((key) =>
    sizeChart.some((size) => size.measurements[key] !== undefined),
  );
  if (sizeChart.length === 0 || rows.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <table className="w-full table-fixed border-collapse text-left font-sans">
        <thead><tr><th scope="col" className="w-1/4 pb-3" />
          {sizeChart.map(({ size }) => <th key={size} scope="col" className="pb-3 text-[9px] font-normal tracking-control text-muted-foreground md:text-[10px]">{size}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((key) => <tr key={key} className="border-t border-border">
            <th scope="row" className="py-3.5 text-[9px] font-normal tracking-control text-muted-foreground md:text-[10px]">{measurementLabels[key]}</th>
            {sizeChart.map(({ size, measurements }) => <td key={size} className="py-3.5 text-xs tracking-control text-foreground md:text-[13px]">{measurements[key] ?? "—"}</td>)}
          </tr>)}
        </tbody>
      </table>
      <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">Medidas en centímetros</p>
    </div>
  );
}
