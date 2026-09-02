import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { OptionAxis, VariantMatrix, VariantView } from "@/modules/catalog";
import { PurchasePanel } from "./purchase-panel";

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
    <PurchasePanel product={product} defaultVariantId={defaultVariantId} />,
    {
      wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
    },
  );
}

function axisGroup(label: string): HTMLElement {
  return screen.getByRole("group", { name: label });
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

describe("PurchasePanel", () => {
  it("renders one selector group per axis, whatever the axes are called", () => {
    renderPanel();

    expect(screen.getAllByRole("group")).toHaveLength(2);
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

    expect(screen.getAllByRole("group")).toHaveLength(3);
  });

  it("renders no selector group at all for a product with no axes", () => {
    renderPanel({ axes: [], variants: [variant(401, [])] }, { defaultVariantId: 401 });

    expect(screen.queryAllByRole("group")).toHaveLength(0);
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

  it("keeps the URL untouched when add-to-cart is activated", async () => {
    const onUrlUpdate = vi.fn();
    renderPanel(TEE, { onUrlUpdate });

    const addToCart = screen.getByRole("button", { name: /agregar al carrito/i });
    await act(async () => {
      addToCart.click();
    });

    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(addToCart.getAttribute("disabled")).toBeNull();
  });

  it("says the garment is gone rather than offering a dead add-to-cart", () => {
    renderPanel(TEE, { searchParams: "?talle=l&color=noir" });

    // A disabled button still reading "Agregar al carrito" reads as a broken
    // site. Naming the reason is what makes the disabled state legible.
    const cta = screen.getByRole("button", { name: /sin stock/i });

    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /agregar al carrito/i })).toBeNull();
  });

  it("shows the transfer price, its label and the list price", () => {
    renderPanel();

    expect(screen.getByText("$24.300")).toBeDefined();
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
    expect(struck.className).toContain("text-muted-foreground");
    expect(screen.getByText("$18.900")).toBeDefined();
    expect(screen.getByText("$17.010")).toBeDefined();
  });
});
