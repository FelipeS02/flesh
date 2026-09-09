import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { GarmentSize } from "@/modules/catalog/client";
import { SizeTable } from "./size-table";

const chart: readonly GarmentSize[] = [
  { size: "M", measurements: { chest_width: 52, garment_length: 68 } },
  { size: "L", measurements: { chest_width: 56, garment_length: 72 } },
];

describe("SizeTable", () => {
  it("renders chart-order columns and canonical sparse measurement rows", () => {
    render(<SizeTable sizeChart={chart} />);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["", "M", "L"]);
    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Ancho de pecho", "Largo de prenda"]);
    expect(within(screen.getByRole("row", { name: /ancho de pecho/i })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["52", "56"]);
    expect(screen.queryByText(/manga/i)).toBeNull();
  });

  it("omits the table when it has no populated measurement row", () => {
    const { container } = render(<SizeTable sizeChart={[{ size: "M", measurements: {} }]} />);
    expect(container.querySelector("table")).toBeNull();
  });
});
