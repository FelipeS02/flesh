import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeProduct, makeVariant } from "../../../test/fixtures/product-view";
import { ProductCard } from "./product-card";

const colourAxis = {
  index: 1 as const,
  label: "Color",
  values: ["Noir", "Bone"],
};

const sizeAxis = { index: 0 as const, label: "Talle", values: ["M"] };

function makeTwoColourProduct() {
  const noir = makeVariant({ id: 201, combination: ["M", "Noir"] });
  const bone = makeVariant({
    id: 202,
    combination: ["M", "Bone"],
    inStock: false,
  });

  return makeProduct({
    axes: [sizeAxis, colourAxis],
    variants: [noir, bone],
    defaultVariantId: noir.id,
  });
}

describe("ProductCard", () => {
  it("links the title to the product's own page", () => {
    render(<ProductCard product={makeProduct({ slug: "musculosa-demon" })} />);

    const link = screen.getByRole("link", {
      name: "Musculosa Demon Wash Black",
    });

    expect(link.getAttribute("href")).toBe("/producto/musculosa-demon");
  });

  it("shows the list price and the transfer price under its label", () => {
    render(
      <ProductCard
        product={makeProduct({
          variants: [
            makeVariant({ price: { amount: 2_700_000, currency: "ARS" } }),
          ],
        })}
      />,
    );

    expect(screen.getByText("$27.000")).not.toBeNull();
    expect(screen.getByText("$24.300")).not.toBeNull();
    expect(screen.getByText(/con transferencia/i)).not.toBeNull();
  });

  it("prices the default variant, not simply the first one", () => {
    const cheap = makeVariant({ id: 201, inStock: false });
    const chosen = makeVariant({
      id: 202,
      price: { amount: 1_000_000, currency: "ARS" },
    });

    render(
      <ProductCard
        product={makeProduct({
          variants: [cheap, chosen],
          defaultVariantId: chosen.id,
        })}
      />,
    );

    expect(screen.getByText("$10.000")).not.toBeNull();
  });

  it("renders one swatch per colour value, naming each for screen readers", () => {
    render(<ProductCard product={makeTwoColourProduct()} />);

    expect(screen.getByText("Noir")).not.toBeNull();
    expect(screen.getByText(/Bone/)).not.toBeNull();
  });

  it("marks a colour with no purchasable variant as sold out", () => {
    render(<ProductCard product={makeTwoColourProduct()} />);

    expect(screen.getByText(/Bone.*agotado/i)).not.toBeNull();
    expect(screen.getByText("Noir")).not.toBeNull();
  });

  it("renders no swatch row for a product whose axes are not colours", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({
          axes: [sizeAxis],
          variants: [makeVariant({ combination: ["M"] })],
        })}
      />,
    );

    expect(container.querySelector("[data-swatch-row]")).toBeNull();
  });

  it("renders the leading image as decorative, since the title link already names the product", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({
          images: [
            { id: 301, src: "/products/1.png", position: 1 },
            { id: 302, src: "/products/2.png", position: 2 },
          ],
        })}
      />,
    );

    const image = container.querySelector("img");

    expect(image?.getAttribute("src")).toContain("1.png");
    expect(image?.getAttribute("alt")).toBe("");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
