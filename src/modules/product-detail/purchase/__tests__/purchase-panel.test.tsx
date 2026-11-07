import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { GarmentSize, OptionAxis, VariantMatrix, VariantView } from "@/modules/catalog";
import type { CartCatalog } from "@/modules/cart/domain/catalog-projection";
import { CartProvider, useCartState } from "@/modules/cart";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { PurchasePanel, PurchasePanelFallback } from "../purchase-panel";

const analyticsSpy = vi.hoisted(() => vi.fn());

// `vi.hoisted` because `vi.mock` factories run before this file's own
// top-level statements (import hoisting) — see `header.test.tsx` for the
// same pattern.
const showAddedToCartSpy = vi.hoisted(() => vi.fn());
const restockActionSpy = vi.hoisted(() => vi.fn());

vi.mock("@/modules/cart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/cart")>();
  return { ...actual, showAddedToCart: showAddedToCartSpy };
});

// The restock form posts through this Server Action; stubbed so no test here
// reaches the real service.
vi.mock("@/modules/newsletter/api/restock.action", () => ({
  requestRestockNotice: restockActionSpy,
}));

vi.mock("@/modules/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/analytics")>();
  return { ...actual, dispatchAnalyticsEvent: analyticsSpy };
});

afterEach(() => {
  restockActionSpy.mockReset();
  showAddedToCartSpy.mockClear();
  analyticsSpy.mockClear();
});

const ARS = "ARS";
const LIST = { amount: 2_700_000, currency: ARS };

function variant(
  id: number,
  combination: string[],
  overrides: Partial<VariantView> = {},
): VariantView {
  return {
    id,
    sku: `SKU-${id}`,
    combination,
    price: LIST,
    compareAt: null,
    inStock: true,
    // Untracked by default: most fixture variants exist only to prove axis
    // selection, not the stock-limit rule, and `stockManagement: false` is
    // the shape that keeps `purchaseLimit` returning `null` for them.
    stockManagement: false,
    stock: null,
    ...overrides,
  };
}

const SIZE: OptionAxis = { index: 0, label: "Talle", values: ["M", "L", "XL"] };
const COLOR: OptionAxis = { index: 1, label: "Color", values: ["Noir", "Bone"] };

/**
 * Two axes, with a hole and a sold-out cell on purpose: XL/Bone was never
 * offered, L/Noir exists but is out of stock. Those are different states and
 * the panel has to tell them apart.
 */
const TEE: VariantMatrix = {
  axes: [SIZE, COLOR],
  variants: [
    variant(201, ["M", "Noir"]),
    variant(202, ["L", "Noir"], { inStock: false }),
    variant(203, ["XL", "Noir"]),
    variant(204, ["M", "Bone"]),
    variant(205, ["L", "Bone"]),
  ],
};

const CART_CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: "tee",
    title: "Tee",
    image: null,
    variants: TEE.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      combination: variant.combination,
      price: variant.price,
      compareAt: variant.compareAt,
      inStock: variant.inStock,
      stockManagement: variant.stockManagement,
      stock: variant.stock,
    })),
  },
];

function CartProbe() {
  const state = useCartState();

  if (state.status === "hydrating") {
    return null;
  }

  return <output data-testid="cart-lines">{state.lines.map((line) => `${line.variantId} x${line.quantity}`).join(",")}</output>;
}

function renderPanel(
  product: VariantMatrix = TEE,
  {
    searchParams = "",
    defaultVariantId = 201,
    onUrlUpdate,
    sizeChart,
  }: {
    searchParams?: string;
    defaultVariantId?: number;
    onUrlUpdate?: OnUrlUpdateFunction;
    sizeChart?: readonly GarmentSize[] | null;
  } = {},
) {
  return render(
    <CartProvider catalog={CART_CATALOG} transferRateBp={1000}>
      <PurchasePanel
        product={product}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={defaultVariantId}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
        sizeChart={sizeChart}
      />
      <CartProbe />
    </CartProvider>,
    {
      wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
    },
  );
}

/** Matches the panel's "Talle" axis (M/L/XL), with measurements so the trigger and modal both have something real to show. */
const SIZE_CHART: GarmentSize[] = [
  { size: "M", measurements: { chest_width: 52 } },
  { size: "L", measurements: { chest_width: 56 } },
  { size: "XL", measurements: { chest_width: 60 } },
];

const EMPTY_SIZE_CHART: GarmentSize[] = [
  { size: "M", measurements: {} },
  { size: "L", measurements: {} },
  { size: "XL", measurements: {} },
];

/**
 * The panel, scoped away from its own shortcut.
 *
 * The mobile widget draws the SAME axis groups and the same add-to-cart
 * button, on purpose — so an unscoped `getByRole` now matches twice. These
 * assertions are about the panel, and the widget has its own file.
 */
function panel(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-purchase-panel]")!;
}

function axisGroup(label: string): HTMLElement {
  return within(panel()).getByRole("group", { name: label });
}

function addToCart(name: RegExp | string): HTMLButtonElement {
  return within(panel()).getByRole("button", { name });
}

function options(label: string): HTMLButtonElement[] {
  return within(axisGroup(label)).getAllByRole("button");
}

function option(label: string, value: string): HTMLButtonElement {
  const found = options(label).find(
    (button) => (button.textContent ?? "").trim().toLowerCase() === value.toLowerCase(),
  );
  if (!found) {
    throw new Error(`No "${value}" option under "${label}"`);
  }
  return found;
}

function expectDesktopConfigurationOrder() {
  const price = within(panel()).getByText("$24.300");
  const separator = within(panel()).getByRole("separator");
  const colourwaySelector = within(panel()).getByTestId("colourway-selector");
  const firstAxis = axisGroup("Talle");
  const cta = addToCart(/agregar al carrito/i);

  for (const [before, after] of [
    [price, separator],
    [separator, colourwaySelector],
    [colourwaySelector, firstAxis],
    [firstAxis, cta],
  ]) {
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  }
}

describe("PurchasePanel", () => {
  it("places colourway navigation between the separator and variant axes", () => {
    renderPanel();

    expectDesktopConfigurationOrder();
  });

  it("renders one selector group per axis, whatever the axes are called", () => {
    renderPanel();

    expect(within(panel()).getAllByRole("group")).toHaveLength(2);
    expect(options("Talle").map((button) => button.textContent?.trim())).toEqual([
      "M",
      "L",
      "XL",
    ]);
  });

  it("renders three groups for a three-axis product", () => {
    renderPanel({
      axes: [
        SIZE,
        COLOR,
        { index: 2, label: "Largo", values: ["Regular", "Oversize"] },
      ],
      variants: [variant(301, ["M", "Noir", "Regular"])],
    });

    expect(within(panel()).getAllByRole("group")).toHaveLength(3);
  });

  it("renders no selector group at all for a product with no axes", () => {
    renderPanel({ axes: [], variants: [variant(401, [])] }, { defaultVariantId: 401 });

    expect(within(panel()).queryAllByRole("group")).toHaveLength(0);
    expect(screen.getByText("$27.000")).toBeDefined();
  });

  it("preselects the default variant's combination", () => {
    renderPanel();

    expect(option("Talle", "M").getAttribute("aria-pressed")).toBe("true");
    expect(option("Color", "Noir").getAttribute("aria-pressed")).toBe("true");
    expect(option("Talle", "L").getAttribute("aria-pressed")).toBe("false");
  });

  it("lets the query string override the default selection", () => {
    renderPanel(TEE, { searchParams: "?talle=xl" });

    expect(option("Talle", "XL").getAttribute("aria-pressed")).toBe("true");
    expect(option("Talle", "M").getAttribute("aria-pressed")).toBe("false");
    // The axis the URL says nothing about keeps the default.
    expect(option("Color", "Noir").getAttribute("aria-pressed")).toBe("true");
  });

  // Shoppers could not reach the restock form because sold-out sizes were
  // unclickable: a sold-out value must look and behave like any other.
  it("keeps an option that exists but is out of stock enabled and selectable", () => {
    renderPanel();

    const soldOut = option("Talle", "L");

    expect(soldOut.disabled).toBe(false);
    // The hint is for assistive tech only; the accessible NAME stays the value.
    expect(soldOut.getAttribute("aria-label")).toBeNull();
    expect(soldOut.getAttribute("aria-description")).toBe("Sin stock");
    expect(soldOut.className).not.toContain("line-through");
  });

  it("disables a combination that was never offered", () => {
    renderPanel(TEE, { searchParams: "?color=bone" });

    // Bone was never made in XL, which is not the same as having sold out.
    expect(option("Talle", "XL").disabled).toBe(true);
    expect(option("Talle", "XL").getAttribute("aria-description")).toBeNull();
  });

  it("writes the chosen value into the query string, lowercased", async () => {
    const onUrlUpdate = vi.fn();
    renderPanel(TEE, { onUrlUpdate });

    // nuqs queues URL writes and flushes them off the click, so the assertion
    // has to let that queue drain before reading the spy.
    fireEvent.click(option("Talle", "XL"));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledOnce());

    const [event] = onUrlUpdate.mock.calls[0]!;
    expect(event.searchParams.get("talle")).toBe("xl");
    // Client-first: a size click must not round-trip to the server.
    expect(event.options.shallow).toBe(true);
  });

  it("adds the resolved in-stock variant to cart without changing the URL", async () => {
    const onUrlUpdate = vi.fn();
    renderPanel(TEE, { onUrlUpdate });

    const cta = addToCart(/agregar al carrito/i);
    await act(async () => {
      cta.click();
    });

    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(cta.getAttribute("disabled")).toBeNull();
    expect(screen.getByTestId("cart-lines").textContent).toBe("201 x1");
    expect(analyticsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "add_to_cart" }),
    );
  });

  it("shows the added-to-cart toast, with repeat=false on the first add and repeat=true on re-add", async () => {
    // `renderPanel` gives `CartProvider` no `storage` override anywhere in
    // this file, so it falls back to the REAL `window.localStorage` — which
    // persists across tests in this file (one jsdom window per file, not per
    // test). Another test in this suite also adds variant 201; without
    // clearing here, this test's cart would rehydrate already containing it.
    window.localStorage.clear();
    renderPanel(TEE);
    const cta = addToCart(/agregar al carrito/i);

    await act(async () => {
      cta.click();
    });
    expect(showAddedToCartSpy).toHaveBeenLastCalledWith({ variantId: 201, repeat: false });

    // `repeat` is computed from the lines BEFORE this dispatch (design D6) —
    // the variant is already in the cart from the click above, so this one
    // is a re-add.
    await act(async () => {
      cta.click();
    });
    expect(showAddedToCartSpy).toHaveBeenLastCalledWith({ variantId: 201, repeat: true });
  });

  it("never offers a dead add-to-cart for a sold-out variant", () => {
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    // A disabled button still reading "Agregar al carrito" reads as a broken
    // site; the restock form takes the CTA's place instead.
    expect(screen.queryByRole("button", { name: /agregar al carrito/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Avisame" })).toBeDefined();
  });

  it("disables the CTA and reads Máximo disponible once the cart already holds the limit", async () => {
    // See the toast test's own note above `renderPanel`: with no `storage`
    // override this file's provider falls back to the REAL `localStorage`,
    // which survives across tests in the same jsdom window.
    window.localStorage.clear();
    const limited: VariantMatrix = {
      axes: [SIZE],
      variants: [variant(601, ["M"], { stockManagement: true, stock: 1 })],
    };

    renderPanel(limited, { defaultVariantId: 601 });
    const cta = addToCart(/agregar al carrito/i);

    await act(async () => {
      cta.click();
    });

    const maxed = addToCart(/m[aá]ximo disponible/i);
    expect(maxed).toBe(cta);
    expect(maxed.disabled).toBe(true);
    expect(screen.getByTestId("cart-lines").textContent).toBe("601 x1");
  });

  it("warns above the CTA when the chosen variant is the last unit", () => {
    window.localStorage.clear();
    const lastOne: VariantMatrix = {
      axes: [SIZE],
      variants: [variant(701, ["M"], { stockManagement: true, stock: 1 })],
    };

    renderPanel(lastOne, { defaultVariantId: 701 });

    const note = within(panel()).getByText("Última unidad disponible");
    const cta = addToCart(/agregar al carrito/i);
    expect(note.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it.each([
    ["more than one unit is left", { stockManagement: true, stock: 2 }],
    ["the merchant does not track stock", { stockManagement: false, stock: null }],
    ["the variant is sold out", { stockManagement: true, stock: 0, inStock: false }],
  ])("says nothing about scarcity when %s", (_, overrides) => {
    window.localStorage.clear();
    renderPanel(
      { axes: [SIZE], variants: [variant(702, ["M"], overrides)] },
      { defaultVariantId: 702 },
    );

    expect(screen.queryByText("Última unidad disponible")).toBeNull();
  });

  it("drops the note once that last unit is already in the cart", async () => {
    // "Máximo disponible" already explains the dead button; a scarcity nudge
    // above a button that cannot be pressed would be urging an impossible act.
    window.localStorage.clear();
    renderPanel(
      { axes: [SIZE], variants: [variant(703, ["M"], { stockManagement: true, stock: 1 })] },
      { defaultVariantId: 703 },
    );

    await act(async () => {
      addToCart(/agregar al carrito/i).click();
    });

    expect(addToCart(/m[aá]ximo disponible/i)).toBeDefined();
    expect(screen.queryByText("Última unidad disponible")).toBeNull();
  });

  it("shows the transfer price, its label and the list price", () => {
    renderPanel();

    expect(within(panel()).getByText("$24.300")).toBeDefined();
    expect(screen.getByText("$27.000")).toBeDefined();
    expect(screen.getByText(/con transferencia/i)).toBeDefined();
  });

  it("strikes the original price when the variant is on promotion", () => {
    const promo: VariantMatrix = {
      axes: [SIZE],
      variants: [
        variant(501, ["M"], {
          price: { amount: 1_890_000, currency: ARS },
          compareAt: LIST,
        }),
      ],
    };

    renderPanel(promo, { defaultVariantId: 501 });

    const struck = screen.getByText("$27.000");

    expect(struck.tagName).toBe("S");
    expect(screen.getByText("$18.900")).toBeDefined();
    expect(within(panel()).getByText("$17.010")).toBeDefined();
  });
});

describe("PurchasePanel axis label sizing", () => {
  it("sizes the non-compact 'Seleccionar Talle' label to the artboard's 11px mobile / 13px desktop", () => {
    renderPanel();

    const label = within(panel()).getByText("Seleccionar Talle").closest("p")!;
    expect(label.className).toContain("text-[11px]");
    expect(label.className).toContain("md:text-[13px]");
  });
});

describe("PurchasePanel size guide", () => {
  it("hides the trigger when no size chart is passed", () => {
    renderPanel();

    expect(within(panel()).queryByRole("button", { name: /guía de talles/i })).toBeNull();
  });

  it("hides the trigger when the chart has no measurements — same rule as accordion 02", () => {
    renderPanel(TEE, { sizeChart: EMPTY_SIZE_CHART });

    expect(within(panel()).queryByRole("button", { name: /guía de talles/i })).toBeNull();
  });

  it("shows a link-styled trigger next to the size axis when the chart has measurements", () => {
    renderPanel(TEE, { sizeChart: SIZE_CHART });

    const trigger = within(panel()).getByRole("button", { name: /guía de talles/i });
    expect(trigger.dataset.variant).toBe("link");
    // Only the size axis gets it — Color shares nothing with the chart's sizes.
    expect(within(axisGroup("Color").parentElement!).queryByRole("button", { name: /guía/i })).toBeNull();
  });

  it("opens a dialog on desktop with the table and the current selection marked", async () => {
    setViewport("desktop");
    renderPanel(TEE, { sizeChart: SIZE_CHART, searchParams: "?talle=l" });

    fireEvent.click(within(panel()).getByRole("button", { name: /guía de talles/i }));

    const dialog = await screen.findByRole("dialog", { name: /guía de talles/i });
    expect(within(dialog).getByRole("table")).toBeDefined();
    expect(within(dialog).getByRole("columnheader", { current: true }).textContent).toBe("L");
  });
});

/**
 * The fallback is what a crawler and a cold visitor actually receive: the PDP
 * is prerendered, so this markup — not the hydrated panel — is the static HTML.
 * It renders with NO nuqs adapter on purpose, because that is the whole reason
 * it exists: reading the query string during a prerender is the bailout the
 * `<Suspense>` boundary works around.
 */
describe("PurchasePanelFallback", () => {
  it("prices the default variant, so the price is in the prerendered HTML", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={201}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expect(screen.getByText("$27.000")).toBeDefined();
  });

  it("opens on the default variant's selection, not on an empty one", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={204}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    const sizes = within(axisGroup("Talle"));
    expect(sizes.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("renders every axis, so the layout does not shift when the panel hydrates", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={201}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expect(axisGroup("Talle")).toBeDefined();
    expect(axisGroup("Color")).toBeDefined();
  });

  it("offers the restock form instead of a CTA when the default variant is sold out", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={202}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expect(within(panel()).queryByRole("button", { name: /sin stock/i })).toBeNull();
    expect(screen.getByRole("heading", { name: "Avisame cuando vuelva" })).toBeDefined();
  });

  it("keeps the colourway slot in the same configuration order", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productTitle="Remera Classic"
        productId={101}
        defaultVariantId={201}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expectDesktopConfigurationOrder();
  });
});

describe("PurchasePanel restock form", () => {
  const restockHeading = () => screen.queryByRole("heading", { name: "Avisame cuando vuelva" });

  // The form IS the answer for a sold-out variant; a dead "Sin stock" block
  // above it only repeated the bad news in the panel's loudest slot.
  it("replaces the CTA with the form for a variant that exists and is sold out", () => {
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    expect(restockHeading()).not.toBeNull();
    expect(within(panel()).queryByRole("button", { name: /sin stock/i })).toBeNull();
  });

  it("names the variant it watches once the request lands", async () => {
    restockActionSpy.mockResolvedValue({ ok: true, status: "created" });
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect(screen.getByText(/L · NOIR/)).toBeDefined();
  });

  it("prepends the page's colourway when the colour is not one of the axes", async () => {
    render(
      <CartProvider catalog={CART_CATALOG} transferRateBp={1000}>
        <PurchasePanel
          product={{ axes: [SIZE], variants: [variant(301, ["M"], { inStock: false })] }}
          productTitle="Remera Classic"
          productId={101}
          defaultVariantId={301}
          colourwaySelector={null}
          colourways={[{ slug: "remera-classic", name: "Negro", hex: "#000", inStock: false }]}
          currentSlug="remera-classic"
        />
      </CartProvider>,
      { wrapper: withNuqsTestingAdapter({ searchParams: "", hasMemory: true }) },
    );

    restockActionSpy.mockResolvedValue({ ok: true, status: "created" });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect(screen.getByText(/NEGRO · M/)).toBeDefined();
  });

  it("reaches the form by clicking a sold-out size, then drops it for an in-stock one", async () => {
    renderPanel(TEE, { searchParams: "?talle=m&color=noir" });

    expect(restockHeading()).toBeNull();

    fireEvent.click(option("Talle", "L"));

    await waitFor(() => expect(restockHeading()).not.toBeNull());
    expect(within(panel()).queryByRole("button", { name: /sin stock/i })).toBeNull();
    // Choosing a size is not buying it.
    expect(screen.getByTestId("cart-lines").textContent).toBe("");

    fireEvent.click(option("Talle", "XL"));

    await waitFor(() => expect(restockHeading()).toBeNull());
    expect(addToCart(/agregar al carrito/i).disabled).toBe(false);
  });

  it("stays out of the way while the variant can be bought", () => {
    renderPanel(TEE, { searchParams: "?talle=m&color=noir" });

    expect(restockHeading()).toBeNull();
  });

  // A combination that was never offered will never be restocked, so
  // promising an email for it would be a lie.
  it("does not offer it for a combination that does not exist", () => {
    renderPanel(TEE, { searchParams: "?talle=xl&color=bone" });

    expect(restockHeading()).toBeNull();
  });

  it("sends the catalogue's product and variant ids with the request", async () => {
    restockActionSpy.mockResolvedValue({ ok: true, status: "created" });
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect(restockActionSpy).toHaveBeenCalledWith({
      email: "fan@flesh.test",
      productId: 101,
      variantId: 202,
      newsletter: false,
    });
  });

  it("leaves the form when the shopper moves to a buyable variant", () => {
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    fireEvent.click(option("Color", "Bone"));

    return waitFor(() => expect(restockHeading()).toBeNull());
  });

  // The confirmation of one size must never survive a switch to another.
  it("starts from an empty form when the selected variant changes", async () => {
    restockActionSpy.mockResolvedValue({ ok: true, status: "created" });
    const twoSoldOut: VariantMatrix = {
      axes: [SIZE],
      variants: [variant(401, ["M"], { inStock: false }), variant(402, ["L"], { inStock: false })],
    };
    const view = (defaultVariantId: number) => (
      <CartProvider catalog={CART_CATALOG} transferRateBp={1000}>
        <PurchasePanelFallback
          product={twoSoldOut}
          productTitle="Remera Classic"
          productId={101}
          defaultVariantId={defaultVariantId}
          colourwaySelector={null}
          colourways={[]}
          currentSlug="remera-classic"
        />
      </CartProvider>
    );
    const { rerender } = render(view(401));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });
    expect(screen.getByRole("heading", { name: "Te avisamos" })).toBeDefined();

    rerender(view(402));

    expect(restockHeading()).not.toBeNull();
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe("");
  });
});
