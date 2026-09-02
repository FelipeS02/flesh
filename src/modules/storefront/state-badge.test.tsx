import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateBadge } from "./state-badge";

describe("StateBadge", () => {
  it("names each state in the brand's own words", () => {
    render(<StateBadge state="new" />);
    expect(screen.getByText("Nuevo")).toBeDefined();

    render(<StateBadge state="featured" />);
    expect(screen.getByText("Destacado")).toBeDefined();

    render(<StateBadge state="soldOut" />);
    expect(screen.getByText("Agotado")).toBeDefined();
  });

  it("writes the labels in ordinary case, because the uppercase is the FONT", () => {
    render(<StateBadge state="soldOut" />);

    // Copperplate Gothic is an all-caps face. A `text-transform` here would be
    // a second, redundant mechanism that only shows up when the font fails.
    expect(screen.queryByText("AGOTADO")).toBeNull();
  });

  it("renders nothing for an ordinary product", () => {
    const { container } = render(<StateBadge state={null} />);

    // Not an empty box: a badge with no state still paints a rectangle over
    // the garment.
    expect(container.firstChild).toBeNull();
  });
});
