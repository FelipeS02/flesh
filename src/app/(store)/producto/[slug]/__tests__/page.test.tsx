import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeProduct } from "../../../../../../test/fixtures/product-view";

const catalog = vi.hoisted(() => ({ product: null as unknown }));

vi.mock("@/modules/catalog", () => ({
  getProductByHandle: async () => catalog.product,
  getColourwayIndex: async () => new Map(),
  getProducts: async () => [],
  colourwayLinks: () => [],
}));

// Chrome and client islands that need a router, a cart or a layout the page
// test does not provide. What is under test is WHICH branch the page picks.
vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", () => ({ Footer: () => null }));
vi.mock("@/components/shared/background-plate", () => ({ PageScrim: () => null }));
vi.mock("@/modules/analytics", () => ({ ProductViewTracker: () => null }));
vi.mock("@/modules/product-detail/gallery/product-gallery", () => ({
  ProductGallery: ({ badge, dimmed }: { badge?: React.ReactNode; dimmed?: boolean }) => (
    <div data-testid='buy-gallery' data-dimmed={String(!!dimmed)}>
      {badge}
    </div>
  ),
}));
vi.mock("@/modules/product-detail/preview/preview-gallery", () => ({
  PreviewGallery: ({ badge }: { badge?: React.ReactNode }) => (
    <div data-testid='preview-gallery'>{badge}</div>
  ),
}));
vi.mock("@/modules/product-detail/purchase/purchase-panel", () => ({
  PurchasePanel: () => <button type='button'>Agregar al carrito</button>,
  PurchasePanelFallback: () => null,
}));
vi.mock("@/modules/newsletter/client", () => ({
  LaunchNotifyForm: () => (
    <form>
      <input type='email' aria-label='RECIBÍ NOVEDADES:' />
      <button type='submit'>Avisame</button>
    </form>
  ),
}));

import ProductPage from "../page";

async function renderPage() {
  render(await ProductPage({ params: Promise.resolve({ slug: "army" }) } as never));
}

describe("ProductPage", () => {
  beforeEach(() => {
    catalog.product = makeProduct({ title: "Army", preview: true });
  });

  it("renders the gallery, title and launch form for a preview product", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Army" })).not.toBeNull();
    expect(screen.getByTestId("preview-gallery")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: /recibí novedades/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /avisame/i })).not.toBeNull();
  });

  it("badges a preview product over its gallery", async () => {
    await renderPage();

    expect(screen.getByText(/preview/i)).not.toBeNull();
  });

  it("offers nothing to buy on a preview product", async () => {
    await renderPage();

    expect(screen.queryByRole("button", { name: /agregar/i })).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("still renders the purchase panel for a regular product", async () => {
    catalog.product = makeProduct({ title: "Demon", preview: false });

    await renderPage();

    expect(screen.getByRole("button", { name: /agregar/i })).not.toBeNull();
    expect(screen.getByTestId("buy-gallery")).not.toBeNull();
    expect(screen.queryByTestId("preview-gallery")).toBeNull();
    expect(screen.queryByRole("button", { name: /avisame/i })).toBeNull();
  });
});
