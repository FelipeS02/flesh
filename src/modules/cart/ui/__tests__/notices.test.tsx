import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CartStoragePort } from "../../api/storage";
import type { CartCatalog } from "../../domain/catalog-projection";
import type { CartNotice } from "../../domain/line";
import { CartProvider } from "../../state/cart-context";
import { CartNotices } from "../notices";

const CATALOG: CartCatalog = [];

function storageWith(notices: CartNotice[]) {
  const writes: unknown[] = [];
  const storage: CartStoragePort = {
    read: () => ({ lines: [], notices: notices.map(toStoredNotice) }),
    write: (cart) => writes.push(cart),
    clear: () => {},
  };

  return { storage, writes };
}

function toStoredNotice(notice: CartNotice) {
  if (notice.kind === "repriced") {
    return {
      kind: "repriced" as const,
      variantId: notice.variantId,
      item: notice.item,
      fromMinor: notice.from.amount,
      toMinor: notice.to.amount,
      currency: notice.to.currency,
    };
  }

  return notice;
}

describe("CartNotices", () => {
  it("explains named and unnamed removals plus price changes", () => {
    const { storage } = storageWith([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Remera / M" },
      { kind: "removed", reason: "unknown-variant", variantId: 202, item: null },
      {
        kind: "repriced",
        variantId: 203,
        item: "Musculosa / L",
        from: { amount: 2_700_000, currency: "ARS" },
        to: { amount: 3_000_000, currency: "ARS" },
      },
    ]);

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
        <CartNotices />
      </CartProvider>,
    );

    expect(screen.getByText("Remera / M ya no está disponible.")).not.toBeNull();
    expect(screen.getByText("Un producto ya no está disponible.")).not.toBeNull();
    expect(screen.getByText("Musculosa / L cambió de $27.000 a $30.000.")).not.toBeNull();
  });

  it("dismisses a notice through provider state and its write-through storage effect", () => {
    const { storage, writes } = storageWith([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Remera / M" },
    ]);

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
        <CartNotices />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso de Remera / M" }));

    expect(screen.queryByText("Remera / M ya no está disponible.")).toBeNull();
    expect(writes.at(-1)).toEqual({ lines: [], notices: [] });
  });

  it("renders a forged or oversized item as text, never markup", () => {
    const item = `<img src=x onerror="window.__cartXss = true">${"x".repeat(5_000)}`;
    const { storage } = storageWith([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item },
    ]);

    render(
      <CartProvider catalog={CATALOG} transferRateBp={1000} storage={storage}>
        <CartNotices />
      </CartProvider>,
    );

    expect(screen.getByText(`${item} ya no está disponible.`)).not.toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(window).not.toHaveProperty("__cartXss");
  });
});
