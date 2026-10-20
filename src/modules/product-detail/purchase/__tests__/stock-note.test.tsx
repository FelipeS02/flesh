import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StockNote, stockGlyphKeyframes } from "../stock-note";
import { STOCK_GLYPH_FRAMES } from "../stock-glyph-frames";

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

  it("draws every frame in the sequence, each one slot later than the last", () => {
    const { container } = render(<StockNote />);

    const frames = [...container.querySelectorAll<SVGSVGElement>("[data-stock-glyph] svg")];
    const count = STOCK_GLYPH_FRAMES.length;
    expect(frames).toHaveLength(count);
    // Negative delays, so the loop is already mid-cycle on first paint
    // instead of showing nothing until the first frame fades in.
    expect(frames.map((frame) => frame.style.animationDelay)).toEqual(
      STOCK_GLYPH_FRAMES.map((_, index) =>
        index === 0 ? "0ms" : `${index * 150 - count * 150}ms`,
      ),
    );
  });
});

describe("stockGlyphKeyframes", () => {
  it.each([3, 4, 6])("gives each of %i frames one slot, cutting straight to the next", (count) => {
    const css = stockGlyphKeyframes(count);
    const at = (percent: number) => `${Number(percent.toFixed(3))}%`;

    expect(css).toContain(`@keyframes stock-glyph-frame-${count}{0%{opacity:1}${at(100 / count)},100%{opacity:0}}`);
    // step-end holds each keyframe's value until the next one: a hard swap,
    // never an opacity tween between frames.
    expect(css).toContain(`${count * 150}ms step-end infinite`);
  });
});
