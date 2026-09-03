import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildColourwayIndex } from "@/modules/catalog/client";
import { makeProduct, makeVariant } from "../../../test/fixtures/product-view";
import { ProductCard } from "./product-card";

/** A catalogue where nothing comes in more than one colour. */
const NO_COLOURWAYS = buildColourwayIndex([]);

const sizeAxis = { index: 0 as const, label: "Talle", values: ["M"] };

/**
 * One design in two colours — separate products, tied by `group`. The bone
 * one is sold out, so the row has a dot to draw in each state.
 */
function makeColourGroup() {
  const noir = makeProduct({
    id: 101,
    slug: "remera-cruz-noir",
    colourway: { group: "remera-cruz", hex: "#0A0A0A", name: "Noir" },
  });

  const bone = makeProduct({
    id: 102,
    slug: "remera-cruz-hueso",
    colourway: { group: "remera-cruz", hex: "#E8E4DA", name: "Bone" },
    variants: [makeVariant({ id: 202, inStock: false })],
  });

  return { noir, bone, colourways: buildColourwayIndex([noir, bone]) };
}

describe("ProductCard", () => {
  it("links the title to the product's own page", () => {
    render(
      <ProductCard
        product={makeProduct({ slug: "musculosa-demon" })}
        colourways={NO_COLOURWAYS}
      />,
    );

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
        colourways={NO_COLOURWAYS}
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
        colourways={NO_COLOURWAYS}
      />,
    );

    expect(screen.getByText("$10.000")).not.toBeNull();
  });

  it("renders one swatch per colour in the group, naming each for screen readers", () => {
    const { noir, colourways } = makeColourGroup();

    render(<ProductCard product={noir} colourways={colourways} />);

    expect(screen.getByText("Noir")).not.toBeNull();
    expect(screen.getByText(/Bone/)).not.toBeNull();
  });

  it("marks a sold-out colour as such", () => {
    const { noir, colourways } = makeColourGroup();

    render(<ProductCard product={noir} colourways={colourways} />);

    expect(screen.getByText(/Bone.*agotado/i)).not.toBeNull();
    expect(screen.getByText("Noir")).not.toBeNull();
  });

  it("links a sibling colour to its own page, since each colour is its own product", () => {
    const { noir, colourways } = makeColourGroup();

    render(<ProductCard product={noir} colourways={colourways} />);

    expect(screen.getByRole("link", { name: /Bone/ }).getAttribute("href")).toBe(
      "/producto/remera-cruz-hueso",
    );
  });

  it("leaves the current colour inert — a link back to this page promises a change it cannot make", () => {
    const { noir, colourways } = makeColourGroup();

    render(<ProductCard product={noir} colourways={colourways} />);

    expect(screen.queryByRole("link", { name: "Noir" })).toBeNull();
    expect(screen.getByText("Noir")).not.toBeNull();
  });

  it("renders no swatch row for a design that comes in one colour", () => {
    const lone = makeProduct({
      slug: "remera-cruz-noir",
      colourway: { group: "remera-cruz", hex: "#0A0A0A", name: "Noir" },
    });

    const { container } = render(
      <ProductCard product={lone} colourways={buildColourwayIndex([lone])} />,
    );

    expect(container.querySelector("[data-swatch-row]")).toBeNull();
  });

  it("renders no swatch row for a product in no colour group at all", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({
          axes: [sizeAxis],
          variants: [makeVariant({ combination: ["M"] })],
        })}
        colourways={NO_COLOURWAYS}
      />,
    );

    expect(container.querySelector("[data-swatch-row]")).toBeNull();
  });

  it("badges a tagged product over its photo", () => {
    render(
      <ProductCard
        product={makeProduct({ tags: ["drop-1", "nuevo"] })}
        colourways={NO_COLOURWAYS}
      />,
    );

    expect(screen.getByText("Nuevo")).not.toBeNull();
  });

  it("dims a sold-out garment and says why", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({ variants: [makeVariant({ inStock: false })] })}
        colourways={NO_COLOURWAYS}
      />,
    );

    expect(screen.getByText("Agotado")).not.toBeNull();
    expect(container.querySelector("img")?.className).toContain("opacity-40");
  });

  it("badges a markdown with its percentage and strikes the original", () => {
    render(
      <ProductCard
        product={makeProduct({
          variants: [
            makeVariant({
              price: { amount: 1_890_000, currency: "ARS" },
              compareAt: { amount: 2_700_000, currency: "ARS" },
            }),
          ],
        })}
        colourways={NO_COLOURWAYS}
      />,
    );

    expect(screen.getByText("-30%")).not.toBeNull();
    expect(screen.getByText("$27.000").tagName).toBe("S");
  });

  it("keeps the badge reachable, outside the image's hidden link", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({ tags: ["nuevo"] })}
        colourways={NO_COLOURWAYS}
      />,
    );

    // The image link is `aria-hidden`, so a badge nested inside it would be
    // the one thing on the card a screen reader could not read.
    const badge = container.querySelector("[data-card-badge]");

    expect(badge).not.toBeNull();
    expect(badge?.closest("[aria-hidden='true']")).toBeNull();
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
        colourways={NO_COLOURWAYS}
      />,
    );

    const image = container.querySelector("img");

    expect(image?.getAttribute("src")).toContain("1.png");
    expect(image?.getAttribute("alt")).toBe("");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
