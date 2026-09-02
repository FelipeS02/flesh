import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { OptionAxis } from "@/modules/catalog/client";
import type { GarmentCut } from "../garment/cuts";
import { SizeTable, sizeColumns } from "./size-table";

// The pattern lists S through XL. The drop below opens at M — which is the
// whole point of the intersection this module owns.
const CUT: GarmentCut = {
  key: "remera-oversize",
  fit: 65,
  measurements: [
    { label: "Largo", bySize: { S: 63, M: 68, L: 73, XL: 78 } },
    { label: "Ancho", bySize: { S: 52, M: 56, L: 61, XL: 65 } },
  ],
};

const SIZE_AXIS: OptionAxis = { index: 0, label: "Talle", values: ["M", "L", "XL"] };

describe("sizeColumns", () => {
  it("keeps the pattern's order rather than the merchant's", () => {
    const axis: OptionAxis = { index: 0, label: "Talle", values: ["XL", "M", "L"] };

    // The cut's table is ordered smallest-first by hand; an axis whose values
    // arrived in another order must not reshuffle a measurement table.
    expect(sizeColumns(CUT, axis)).toEqual(["M", "L", "XL"]);
  });

  it("drops a size the pattern has but the product does not sell", () => {
    expect(sizeColumns(CUT, SIZE_AXIS)).not.toContain("S");
  });

  it("matches sizes ignoring casing and stray whitespace", () => {
    const axis: OptionAxis = { index: 0, label: "Talle", values: [" m ", "xl"] };

    expect(sizeColumns(CUT, axis)).toEqual(["M", "XL"]);
  });

  it("falls back to the pattern's full range when nothing constrains it", () => {
    // No size axis means no size is on sale over any other, so filtering has
    // nothing to filter BY — the pattern's own table is the honest answer.
    expect(sizeColumns(CUT, null)).toEqual(["S", "M", "L", "XL"]);
  });
});

describe("SizeTable", () => {
  it("draws a real table, so the numbers are read with their labels", () => {
    render(<SizeTable cut={CUT} sizeAxis={SIZE_AXIS} />);

    expect(screen.getByRole("table")).toBeDefined();
  });

  it("heads one column per size on sale", () => {
    render(<SizeTable cut={CUT} sizeAxis={SIZE_AXIS} />);

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);

    // The leading corner cell is empty — it heads the measurement column.
    expect(headers).toEqual(["", "M", "L", "XL"]);
  });

  it("gives every measurement its own row, in centimetres", () => {
    render(<SizeTable cut={CUT} sizeAxis={SIZE_AXIS} />);

    const row = screen.getByRole("row", { name: /largo/i });

    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "68",
      "73",
      "78",
    ]);
  });

  it("states the unit once, because a bare 68 is not a measurement", () => {
    render(<SizeTable cut={CUT} sizeAxis={SIZE_AXIS} />);

    expect(screen.getAllByText(/centímetros/i)).toHaveLength(1);
  });
});
