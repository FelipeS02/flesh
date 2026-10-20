import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { GarmentSize } from "@/modules/catalog/client";
import { SizeTable } from "../size-table";

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

  it("marks the shopper's selected size with aria-current, case/whitespace-insensitively", () => {
    render(<SizeTable sizeChart={chart} highlightSize=" l " />);

    const current = screen.getByRole("columnheader", { current: true });
    expect(current.textContent).toBe("L");
  });

  it("marks no column when nothing is selected yet", () => {
    render(<SizeTable sizeChart={chart} />);
    expect(screen.queryByRole("columnheader", { current: true })).toBeNull();
  });

  it("hides its own caption when the caller already prints one", () => {
    render(<SizeTable sizeChart={chart} hideCaption />);
    expect(screen.queryByText(/Medidas en CM/)).toBeNull();
    expect(screen.queryByText(/recomendamos el más grande/)).toBeNull();
  });

  it("sizes header, row-header and caption text to the artboard's 11px mobile / 13px desktop", () => {
    render(<SizeTable sizeChart={chart} />);

    const columnHeader = screen.getAllByRole("columnheader").find((cell) => cell.textContent === "M")!;
    expect(columnHeader.className).toContain("text-[11px]");
    expect(columnHeader.className).toContain("md:text-[13px]");

    const rowHeader = screen.getByRole("rowheader", { name: "Ancho de pecho" });
    expect(rowHeader.className).toContain("text-[11px]");
    expect(rowHeader.className).toContain("md:text-[13px]");

    expect(screen.getByText(/Medidas en CM/).closest("p")!.className).toContain("text-[11px]");
  });

  it("prints the measurement disclaimer and the sizing advice as its caption", () => {
    render(<SizeTable sizeChart={chart} />);
    expect(screen.getByText("Medidas en CM. Los talles pueden variar 1/2 cm.")).toBeTruthy();
    expect(screen.getByText("Si estás entre dos talles, recomendamos el más grande.")).toBeTruthy();
  });

  it("centres each size header on the same axis as its values", () => {
    render(<SizeTable sizeChart={chart} />);
    const header = screen.getAllByRole("columnheader").find((cell) => cell.textContent === "M")!;
    expect(header.className).toContain("text-center");
    for (const cell of screen.getAllByRole("cell")) expect(cell.className).toContain("text-center");
  });
});
