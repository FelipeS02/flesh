import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StockNote } from "../stock-note";

describe("StockNote", () => {
  it("says it is the last unit", () => {
    render(<StockNote />);

    expect(screen.getByText("Última unidad disponible")).toBeDefined();
  });

  it("keeps the glyph out of the accessibility tree", () => {
    const { container } = render(<StockNote />);

    // The sentence already says everything; a skull read aloud as "image"
    // four times over would only be noise.
    const glyph = container.querySelector("[data-stock-glyph]")!;
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("draws all four frames, each starting a quarter of the loop later", () => {
    const { container } = render(<StockNote />);

    const frames = [...container.querySelectorAll<SVGSVGElement>("[data-stock-glyph] svg")];
    expect(frames).toHaveLength(4);
    // Negative delays, so the loop is already mid-cycle on first paint
    // instead of showing nothing until the first frame fades in.
    expect(frames.map((frame) => frame.style.animationDelay)).toEqual([
      "0ms",
      "-420ms",
      "-280ms",
      "-140ms",
    ]);
  });
});
