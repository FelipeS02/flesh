import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FitScale } from "../fit-scale";

describe("FitScale", () => {
  it("uses the contextual top endpoint in visible and assistive text", () => {
    const { container } = render(<FitScale fit={{ type: "top", position: 100 }} />);
    expect(screen.getByText("Oversized")).toBeTruthy();
    expect(container.querySelector("[data-fit-marker]")?.getAttribute("style")).toContain("100%");
    expect(screen.getByText(/oversized/i, { selector: ".sr-only" })).toBeTruthy();
  });

  it("uses Baggy for a bottom fit and retains the bounded position", () => {
    const { container } = render(<FitScale fit={{ type: "bottom", position: 0 }} />);
    expect(screen.getByText("Baggy")).toBeTruthy();
    expect(container.querySelector("[data-fit-marker]")?.getAttribute("style")).toContain("0%");
    expect(screen.getByText(/baggy/i, { selector: ".sr-only" })).toBeTruthy();
  });

  it("sizes the 'Fit' label and its stops to the artboard's 11px mobile / 13px desktop", () => {
    render(<FitScale fit={{ type: "top", position: 50 }} />);

    expect(screen.getByText("Fit").className).toContain("text-[11px]");
    expect(screen.getByText("Fit").className).toContain("md:text-[13px]");
    expect(screen.getByText("Slim").parentElement?.className).toContain("text-[11px]");
  });
});
