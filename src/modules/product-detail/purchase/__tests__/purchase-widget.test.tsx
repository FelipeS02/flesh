import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ColourwayLink, GarmentSize, VariantMatrix, VariantView } from "@/modules/catalog";
import { PurchaseWidget } from "../purchase-widget";

const ARS = "ARS";
const LIST = { amount: 2_700_000, currency: ARS };

function variant(
  id: number,
  combination: string[],
  overrides: Partial<VariantView> = {},
): VariantView {
  return {
    id,
    sku: null,
    combination,
    price: LIST,
    compareAt: null,
    inStock: true,
    stockManagement: false,
    stock: null,
    ...overrides,
  };
}

const TEE: VariantMatrix = {
  axes: [{ index: 0, label: "Talle", values: ["M", "L", "XL"] }],
  variants: [
    variant(201, ["M"]),
    variant(202, ["L"], { inStock: false }),
    variant(203, ["XL"]),
  ],
};

const COLOURWAYS: ColourwayLink[] = [
  { slug: "tee-noir", name: "Noir", hex: "#0A0A0A", inStock: true },
  { slug: "tee-bone", name: "Bone", hex: "#E8E4DA", inStock: true },
];

function renderWidget(overrides: Partial<Parameters<typeof PurchaseWidget>[0]> = {}) {
  const props = {
    product: TEE,
    selection: ["M"],
    colourways: COLOURWAYS,
    currentSlug: "tee-noir",
    priced: TEE.variants[0],
    canAddToCart: true,
    ctaLabel: "Agregar al carrito",
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };

  return { ...render(<PurchaseWidget {...props} />), props };
}

function widget(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-purchase-widget]")!;
}

describe("PurchaseWidget", () => {
  it("shows the transfer price on the button, not the list price", () => {
    renderWidget();

    // 10% off 27.000. The widget's one line carries the figure most of this
    // drop's buyers actually pay; the list price stays in the panel below.
    expect(within(widget()).getByText("$24.300")).toBeDefined();
    expect(within(widget()).queryByText("$27.000")).toBeNull();
  });

  it("opens visible, because the panel it shortcuts is always below the fold", () => {
    renderWidget();

    expect(widget().getAttribute("data-visible")).toBe("true");
    expect(widget().getAttribute("aria-hidden")).toBeNull();
  });

  it("draws one selector per axis and reports the chosen value by index", () => {
    const { props } = renderWidget();

    const sizes = within(screen.getByRole("group", { name: "Talle" }));
    expect(sizes.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(sizes.getByRole("button", { name: "XL" }));

    expect(props.onSelect).toHaveBeenCalledWith(0, "XL");
  });

  it("keeps an unbuyable option unselectable here too", () => {
    renderWidget();

    const sizes = within(screen.getByRole("group", { name: "Talle" }));

    expect(sizes.getByRole("button", { name: /agotado/i }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("links each colour to its own page rather than setting state", () => {
    renderWidget();

    const other = within(widget()).getByRole("link", { name: "Bone" });

    expect(other.getAttribute("href")).toBe("/producto/tee-bone");
  });

  it("renders no colour block for a product that has no other colourways", () => {
    renderWidget({ colourways: [] });

    expect(within(widget()).queryByRole("list", { name: "Colores" })).toBeNull();
  });

  it("says what is wrong instead of offering a dead button", () => {
    const { props } = renderWidget({ canAddToCart: false, ctaLabel: "Sin stock" });

    const cta = within(widget()).getByRole("button", { name: /sin stock/i });

    expect(cta.hasAttribute("disabled")).toBe(true);

    fireEvent.click(cta);

    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("adds the resolved variant from its own button", () => {
    const { props } = renderWidget();

    fireEvent.click(within(widget()).getByRole("button", { name: /agregar al carrito/i }));

    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it("renders its own compact 'Guía' size-guide trigger right after the size label", () => {
    const sizeChart: GarmentSize[] = [
      { size: "M", measurements: { chest_width: 52 } },
      { size: "L", measurements: { chest_width: 56 } },
      { size: "XL", measurements: { chest_width: 60 } },
    ];

    renderWidget({ sizeChart });

    expect(within(widget()).getByRole("button", { name: "Guía" })).toBeDefined();
  });

  it("hides the size-guide trigger when no chart is passed", () => {
    renderWidget();

    expect(within(widget()).queryByRole("button", { name: "Guía" })).toBeNull();
  });
});
