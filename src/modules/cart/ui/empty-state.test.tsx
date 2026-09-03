import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CartLine } from "../domain/line";
import { EmptyState } from "./empty-state";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return { productId: 101, variantId: 201, quantity: 1, price: PRICE, ...overrides };
}

describe("EmptyState", () => {
  // The load-bearing case (Engram obs #248): while hydrating, `state.lines`
  // does not even exist on the type, so a component that narrowed nowhere
  // would fail to compile, not merely fail this assertion. This test proves
  // the RUNTIME half of that guarantee — a hydrating cart, which may be
  // holding three stored lines nobody has read yet, must never announce
  // itself as empty.
  it("renders nothing while hydrating, even though it cannot know the cart is empty", () => {
    render(<EmptyState state={{ status: "hydrating" }} />);

    expect(screen.queryByText(/carrito/i)).toBeNull();
  });

  it("renders the empty state once ready with zero lines", () => {
    render(<EmptyState state={{ status: "ready", lines: [], notices: [] }} />);

    expect(screen.getByText("Tu carrito esta vacio")).not.toBeNull();
  });

  it("renders nothing when ready but lines are present", () => {
    render(<EmptyState state={{ status: "ready", lines: [makeLine()], notices: [] }} />);

    expect(screen.queryByText(/vacio/i)).toBeNull();
  });
});
