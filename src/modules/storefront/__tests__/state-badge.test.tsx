import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateBadge } from "../state-badge";

describe("StateBadge", () => {
  it("names each state in the brand's own words", () => {
    render(<StateBadge state="new" />);
    expect(screen.getByText("Nuevo")).toBeDefined();

    render(<StateBadge state="featured" />);
    expect(screen.getByText("Destacado")).toBeDefined();

    render(<StateBadge state="soldOut" />);
    expect(screen.getByText("Agotado")).toBeDefined();

    render(<StateBadge state="lowStock" />);
    expect(screen.getByText("Últimas unidades")).toBeDefined();
  });

  it("renders nothing for an ordinary product", () => {
    const { container } = render(<StateBadge state={null} />);

    // Not an empty box: a badge with no state still paints a rectangle over
    // the garment.
    expect(container.firstChild).toBeNull();
  });
});
