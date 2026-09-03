import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ColourwayLink } from "@/modules/catalog/client";
import { ColourwaySelector } from "./colourway-selector";

const links: ColourwayLink[] = [
  { hex: "#0A0A0A", name: "Noir", slug: "remera-cruz-noir", inStock: true },
  { hex: "#E8E4DA", name: "Bone", slug: "remera-cruz-hueso", inStock: false },
];

describe("ColourwaySelector", () => {
  it("links every other colour to its own product page", () => {
    render(<ColourwaySelector links={links} currentSlug="remera-cruz-noir" />);

    expect(screen.getByRole("link", { name: /Bone/ }).getAttribute("href")).toBe(
      "/producto/remera-cruz-hueso",
    );
  });

  it("leaves the current colour as a marker rather than a link to this page", () => {
    render(<ColourwaySelector links={links} currentSlug="remera-cruz-noir" />);

    expect(screen.queryByRole("link", { name: "Noir" })).toBeNull();
    expect(screen.getByText("Noir", { selector: ".sr-only" })).not.toBeNull();
  });

  it("names the current colour beside the label, since a dot cannot say its own name", () => {
    const { container } = render(
      <ColourwaySelector links={links} currentSlug="remera-cruz-hueso" />,
    );

    expect(container.querySelector("p")?.textContent).toContain("Bone");
  });

  it("says a colour is sold out instead of only dimming it", () => {
    render(<ColourwaySelector links={links} currentSlug="remera-cruz-noir" />);

    expect(screen.getByText(/Bone.*agotado/i)).not.toBeNull();
  });

  it("keeps a sold-out colour reachable — its page still has the photos", () => {
    render(<ColourwaySelector links={links} currentSlug="remera-cruz-noir" />);

    expect(screen.getByRole("link", { name: /Bone/ })).not.toBeNull();
  });

  it("paints each dot with the merchant's own hex, never a guess from the name", () => {
    const { container } = render(
      <ColourwaySelector links={links} currentSlug="remera-cruz-noir" />,
    );

    const fills = [...container.querySelectorAll<HTMLElement>("span.size-10")];

    expect(fills.map((fill) => fill.style.backgroundColor)).toEqual([
      "rgb(10, 10, 10)",
      "rgb(232, 228, 218)",
    ]);
  });

  it("renders nothing for a garment that comes in one colour", () => {
    const { container } = render(
      <ColourwaySelector links={[]} currentSlug="remera-cruz-noir" />,
    );

    expect(container.innerHTML).toBe("");
  });
});
