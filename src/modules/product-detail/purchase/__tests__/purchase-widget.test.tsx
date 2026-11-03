import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ColourwayLink, GarmentSize, VariantMatrix, VariantView } from "@/modules/catalog";
import { BOTTOM_DOCK_PROPERTY } from "@/hooks/use-bottom-dock";
import { installControllableResizeObserver } from "../../../../../test/fixtures/observers";
import { PurchaseWidget } from "../purchase-widget";

const restockActionSpy = vi.hoisted(() => vi.fn());

// Stubbed so the sheet's form never reaches the real service.
vi.mock("@/modules/newsletter/api/restock.action", () => ({
  requestRestockNotice: restockActionSpy,
}));

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

  it("puts the last-unit note above its button when told it is the last unit", () => {
    renderWidget({ lastUnit: true });

    const note = within(widget()).getByText("Última unidad disponible");
    const cta = within(widget()).getByRole("button", { name: /agregar al carrito/i });

    expect(note.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("shows no last-unit note by default", () => {
    renderWidget();

    expect(within(widget()).queryByText("Última unidad disponible")).toBeNull();
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

describe("PurchaseWidget as a bottom dock", () => {
  let resize: ReturnType<typeof installControllableResizeObserver>;
  let descriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    resize = installControllableResizeObserver();
    descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 132,
    });
  });

  afterEach(() => {
    resize.restore();
    if (descriptor) Object.defineProperty(HTMLElement.prototype, "offsetHeight", descriptor);
    document.documentElement.style.removeProperty(BOTTOM_DOCK_PROPERTY);
  });

  // The newsletter banner reads this to sit ABOVE the widget instead of
  // covering the one control the PDP exists for.
  it("publishes its height while it is on screen", () => {
    renderWidget();

    expect(document.documentElement.style.getPropertyValue(BOTTOM_DOCK_PROPERTY)).toBe("132px");
  });

  it("stops publishing when it leaves the page", () => {
    const { unmount } = renderWidget();

    unmount();

    expect(document.documentElement.style.getPropertyValue(BOTTOM_DOCK_PROPERTY)).toBe("");
  });
});

describe("PurchaseWidget on a sold-out variant", () => {
  const RESTOCK = { productId: 101, variantId: 202, variantLine: "NEGRO · L" };

  function renderSoldOut() {
    return renderWidget({
      canAddToCart: false,
      ctaLabel: "Sin stock",
      selection: ["L"],
      restock: RESTOCK,
    });
  }

  it("swaps the dead 'Sin stock' button for the way to ask for a restock", () => {
    const { props } = renderSoldOut();

    const cta = within(widget()).getByRole("button", { name: "Avisame cuando vuelva" });

    expect(within(widget()).queryByRole("button", { name: /sin stock/i })).toBeNull();
    expect((cta as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(cta);

    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("does not show it, and keeps adding to the cart, while the variant is buyable", () => {
    renderWidget();

    expect(screen.queryByRole("button", { name: "Avisame cuando vuelva" })).toBeNull();
    expect(within(widget()).getByRole("button", { name: /agregar al carrito/i })).toBeDefined();
  });

  it("opens a bottom sheet with the form, titled and described by the variant", () => {
    renderSoldOut();

    fireEvent.click(within(widget()).getByRole("button", { name: "Avisame cuando vuelva" }));

    const sheet = screen.getByRole("dialog", { name: "Avisame cuando vuelva" });

    expect(sheet.getAttribute("data-side")).toBe("bottom");
    expect(within(sheet).getByText("NEGRO · L")).toBeDefined();
    expect(within(sheet).getByLabelText("EMAIL")).toBeDefined();
    expect(within(sheet).getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
  });

  it("sends the request for the variant it was given", async () => {
    restockActionSpy.mockResolvedValue({ ok: true, status: "created" });
    renderSoldOut();

    fireEvent.click(within(widget()).getByRole("button", { name: "Avisame cuando vuelva" }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("EMAIL"), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Avisame" }));
    });

    expect(restockActionSpy).toHaveBeenCalledWith({
      email: "fan@flesh.test",
      productId: 101,
      variantId: 202,
      newsletter: false,
    });
  });
});
