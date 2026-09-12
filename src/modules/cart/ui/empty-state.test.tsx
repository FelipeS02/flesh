import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartLine } from "../domain/line";
import { EmptyState } from "./empty-state";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return { productId: 101, variantId: 201, quantity: 1, price: PRICE, ...overrides };
}

function cta(): HTMLElement {
  return screen.getByRole("link", { name: "Ver el drop" });
}

describe("EmptyState", () => {
  // The load-bearing case (Engram obs #248): while hydrating, `state.lines`
  // does not even exist on the type, so a component that narrowed nowhere
  // would fail to compile, not merely fail this assertion. This test proves
  // the RUNTIME half of that guarantee — a hydrating cart, which may be
  // holding three stored lines nobody has read yet, must never announce
  // itself as empty.
  it("renders nothing while hydrating, even though it cannot know the cart is empty", () => {
    render(<EmptyState state={{ status: "hydrating" }} onBrowse={vi.fn()} />);

    expect(screen.queryByText(/carrito/i)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders the empty state once ready with zero lines", () => {
    render(
      <EmptyState state={{ status: "ready", lines: [], notices: [] }} onBrowse={vi.fn()} />,
    );

    expect(screen.getByText("Tu carrito esta vacio")).not.toBeNull();
    expect(
      screen.getByText("Todavia no elegiste ninguna pieza del Volumen I"),
    ).not.toBeNull();
  });

  it("renders nothing when ready but lines are present", () => {
    render(
      <EmptyState
        state={{ status: "ready", lines: [makeLine()], notices: [] }}
        onBrowse={vi.fn()}
      />,
    );

    expect(screen.queryByText(/vacio/i)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  // There is no catalogue route — the drop lives on the landing, under the
  // anchor the header nav already points at. A CTA that invented a URL of its
  // own would 404 the one shopper who had nothing else to click.
  it("sends the shopper to the drop on the landing", () => {
    render(
      <EmptyState state={{ status: "ready", lines: [], notices: [] }} onBrowse={vi.fn()} />,
    );

    expect(cta().getAttribute("href")).toBe("/#catalogo");
  });

  // The drawer is an overlay over the very catalogue the CTA points at, so
  // navigating without closing leaves the shopper on the drop with the cart
  // still covering it.
  it("closes the drawer on the way out", () => {
    const onBrowse = vi.fn();

    render(
      <EmptyState state={{ status: "ready", lines: [], notices: [] }} onBrowse={onBrowse} />,
    );
    fireEvent.click(cta());

    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  // The display face (Kraut) carries no accented Latin-1 glyphs, so an accent
  // anywhere in this block is a character that silently fails to draw.
  it("keeps every line inside ASCII, as the display face requires", () => {
    const { container } = render(
      <EmptyState state={{ status: "ready", lines: [], notices: [] }} onBrowse={vi.fn()} />,
    );

    expect(container.textContent).toMatch(/^[\x00-\x7F]*$/);
  });
});
