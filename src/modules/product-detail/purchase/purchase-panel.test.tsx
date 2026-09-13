import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { OptionAxis, VariantMatrix, VariantView } from "@/modules/catalog";
import type { CartCatalog } from "@/modules/cart/domain/catalog-projection";
import { CartProvider, useCartState } from "@/modules/cart";
import { PurchasePanel, PurchasePanelFallback } from "./purchase-panel";

// `vi.hoisted` because `vi.mock` factories run before this file's own
// top-level statements (import hoisting) — see `header.test.tsx` for the
// same pattern.
const showAddedToCartSpy = vi.hoisted(() => vi.fn());

vi.mock("@/modules/cart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/cart")>();
  return { ...actual, showAddedToCart: showAddedToCartSpy };
});

afterEach(() => {
  showAddedToCartSpy.mockClear();
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
  }: {
    searchParams?: string;
    defaultVariantId?: number;
    onUrlUpdate?: OnUrlUpdateFunction;
  } = {},
) {
  return render(
    <CartProvider catalog={CART_CATALOG} transferRateBp={1000}>
      <PurchasePanel
        product={product}
        productId={101}
        defaultVariantId={defaultVariantId}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />
      <CartProbe />
    </CartProvider>,
    {
      wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
    },
  );
}

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

  it("disables an option that exists but is out of stock, and says so", () => {
    renderPanel();

    const soldOut = option("Talle", "L");

    expect(soldOut.disabled).toBe(true);
    expect(soldOut.getAttribute("aria-label")).toContain("agotado");
  });

  it("disables a combination that was never offered", () => {
    renderPanel(TEE, { searchParams: "?color=bone" });

    // Bone was never made in XL, which is not the same as having sold out.
    expect(option("Talle", "XL").disabled).toBe(true);
    expect(option("Talle", "XL").getAttribute("aria-label") ?? "").not.toContain(
      "agotado",
    );
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

  it("says the garment is gone rather than offering a dead add-to-cart", () => {
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    // A disabled button still reading "Agregar al carrito" reads as a broken
    // site. Naming the reason is what makes the disabled state legible.
    const cta = addToCart(/sin stock/i);

    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /agregar al carrito/i })).toBeNull();
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
        productId={101}
        defaultVariantId={201}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expect(axisGroup("Talle")).toBeDefined();
    expect(axisGroup("Color")).toBeDefined();
  });

  it("says what the default variant's CTA says", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productId={101}
        defaultVariantId={202}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expect(addToCart("Sin stock")).toBeDefined();
  });

  it("keeps the colourway slot in the same configuration order", () => {
    render(<PurchasePanelFallback
        product={TEE}
        productId={101}
        defaultVariantId={201}
        colourwaySelector={<div data-testid="colourway-selector" />}
        colourways={[]}
        currentSlug="remera-classic"
      />);

    expectDesktopConfigurationOrder();
  });
});
