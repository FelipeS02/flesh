import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FitScale } from "./fit-scale";

function marker(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>("[data-fit-marker]");
  if (!found) {
    throw new Error("The scale rendered no marker");
  }
  return found;
}

describe("FitScale", () => {
  it("names the three stops the scale runs between", () => {
    render(<FitScale fit={50} />);

    expect(screen.getByText("Slim")).toBeDefined();
    expect(screen.getByText("True to size")).toBeDefined();
    expect(screen.getByText("Oversized")).toBeDefined();
  });

  it("puts the marker exactly where the cut sits, not at the nearest stop", () => {
    const { container } = render(<FitScale fit={65} />);

    expect(marker(container).style.left).toBe("65%");
  });

  it("pins the slimmest cut to the start of the track", () => {
    const { container } = render(<FitScale fit={0} />);

    expect(marker(container).style.left).toBe("0%");
  });

  it("pins the baggiest cut to the end of the track", () => {
    const { container } = render(<FitScale fit={100} />);

    expect(marker(container).style.left).toBe("100%");
  });

  it("clamps a value off the scale instead of drawing the mark off the line", () => {
    const { container: over } = render(<FitScale fit={140} />);
    expect(marker(over).style.left).toBe("100%");

    const { container: under } = render(<FitScale fit={-20} />);
    expect(marker(under).style.left).toBe("0%");
  });

  it("rounds to a whole percent so the mark never lands on a sub-pixel", () => {
    const { container } = render(<FitScale fit={65.4} />);

    expect(marker(container).style.left).toBe("65%");
  });

  it("draws the brand mark rather than a bare shape", () => {
    const { container } = render(<FitScale fit={65} />);

    expect(marker(container).querySelector("svg")).not.toBeNull();
  });

  it("states the position in words, because a mark on a line is not a label", () => {
    render(<FitScale fit={65} />);

    // The track is decoration and hidden from assistive tech, so the reading
    // has to exist somewhere a screen reader can reach it.
    expect(screen.getByRole("group", { name: /fit/i }).textContent).toContain("65");
  });
});
