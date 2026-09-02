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
  it("names all three stops, so the marked one has something to mean", () => {
    render(<FitScale fit="true" />);

    expect(screen.getByText("Slim")).toBeDefined();
    expect(screen.getByText("True to size")).toBeDefined();
    expect(screen.getByText("Baggy")).toBeDefined();
  });

  it("puts the marker at the left end for a slim cut", () => {
    const { container } = render(<FitScale fit="slim" />);

    expect(marker(container).className).toContain("left-0");
  });

  it("centres the marker for a true-to-size cut", () => {
    const { container } = render(<FitScale fit="true" />);

    expect(marker(container).className).toContain("left-1/2");
  });

  it("puts the marker at the right end for a baggy cut", () => {
    const { container } = render(<FitScale fit="baggy" />);

    expect(marker(container).className).toContain("right-0");
  });

  it("states the fit in words too, because a dot on a line is not a label", () => {
    render(<FitScale fit="baggy" />);

    expect(screen.getByRole("group", { name: /fit/i }).textContent).toContain("Baggy");
  });
});
