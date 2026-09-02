import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VariantView } from "@/modules/catalog/client";
import { PriceBlock } from "./price-block";

function variant(overrides: Partial<VariantView> = {}): VariantView {
  return {
    id: 1,
    combination: ["M"],
    price: { amount: 1_890_000, currency: "ARS" },
    compareAt: null,
    inStock: true,
    ...overrides,
  };
}

describe("PriceBlock", () => {
  it("leads with the transfer price, which is what most of this drop pays", () => {
    render(<PriceBlock variant={variant()} />);

    expect(screen.getByText("$17.010")).toBeDefined();
    expect(screen.getByText(/con transferencia/i)).toBeDefined();
  });

  it("badges the markdown next to the price it is computed from", () => {
    render(
      <PriceBlock
        variant={variant({ compareAt: { amount: 2_700_000, currency: "ARS" } })}
      />,
    );

    const original = screen.getByText("$27.000");

    // The struck original and its percentage are one statement: 27.000 down to
    // 18.900. Reading either alone tells you less than half of it, so they
    // share a row rather than sitting on separate lines.
    expect(original.tagName).toBe("S");
    expect(original.parentElement?.textContent).toContain("-30%");
  });

  it("says the percentage in words, because '-30%' is not a sentence", () => {
    render(
      <PriceBlock
        variant={variant({ compareAt: { amount: 2_700_000, currency: "ARS" } })}
      />,
    );

    expect(screen.getByText("30% de descuento")).toBeDefined();
  });

  it("badges nothing on a product that was never marked down", () => {
    render(<PriceBlock variant={variant()} />);

    // The transfer discount is a labelled price, never a badge — so a product
    // with no `compareAt` carries no percentage anywhere.
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
