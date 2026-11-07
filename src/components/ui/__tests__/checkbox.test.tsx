import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  it("is unchecked until the shopper checks it", () => {
    render(<Checkbox aria-label="Quiero novedades" />);

    expect(screen.getByRole("checkbox", { name: "Quiero novedades" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("reports the new state when toggled", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Quiero novedades" onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Quiero novedades" }));

    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
  });

  // The app's corners are square (`--radius: 0`). The registry ships a literal
  // 4px, which `--radius` cannot reach, so it has to stay scaled by the token.
  it("takes its corner from the radius token instead of a fixed pixel value", () => {
    render(<Checkbox aria-label="Quiero novedades" />);

    const className = screen.getByRole("checkbox").className;

    expect(className).not.toContain("rounded-[4px]");
    expect(className).toContain("var(--radius-md)");
  });
});
