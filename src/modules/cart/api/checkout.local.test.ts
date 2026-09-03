import { describe, expect, it } from "vitest";
import type { CartCatalog } from "../domain/catalog-projection";
import type { CartLine } from "../domain/line";
import { CHECKOUT_UNAVAILABLE_REASON, createLocalCheckout } from "./checkout.local";

const PRICE = { amount: 2_700_000, currency: "ARS" } as const;

/**
 * A synthetic catalog, not the real fixtures, and that is the whole reason
 * `rejected` is testable at all: every fixture variant is in stock, so through
 * the product the local port can only ever answer `unavailable` (design D5).
 * Hand-building an out-of-stock variant is the only honest way to prove the
 * rejection branch is real code rather than a comment.
 */
function catalogWith(variants: Array<{ id: number; inStock: boolean }>): CartCatalog {
  return [
    {
      productId: 101,
      slug: "remera-classic",
      title: "Remera Classic",
      image: null,
      variants: variants.map(({ id, inStock }) => ({
        id,
        combination: ["M", "Negro"],
        price: PRICE,
        inStock,
      })),
    },
  ];
}

function lineFor(variantId: number): CartLine {
  return { productId: 101, variantId, quantity: 1, price: PRICE };
}

describe("createLocalCheckout", () => {
  it("rejects a cart holding a variant the catalog now reports out of stock", async () => {
    const checkout = createLocalCheckout(catalogWith([{ id: 201, inStock: false }]));

    const outcome = await checkout.startCheckout({ lines: [lineFor(201)] });

    expect(outcome).toEqual({ status: "rejected", lines: [201] });
  });

  it("rejects a variant the catalog no longer knows at all", async () => {
    const checkout = createLocalCheckout(catalogWith([{ id: 201, inStock: true }]));

    const outcome = await checkout.startCheckout({ lines: [lineFor(999)] });

    expect(outcome).toEqual({ status: "rejected", lines: [999] });
  });

  it("names every unavailable line, not just the first one it finds", async () => {
    const checkout = createLocalCheckout(
      catalogWith([
        { id: 201, inStock: false },
        { id: 202, inStock: true },
        { id: 203, inStock: false },
      ]),
    );

    const outcome = await checkout.startCheckout({
      lines: [lineFor(201), lineFor(202), lineFor(203)],
    });

    expect(outcome).toEqual({ status: "rejected", lines: [201, 203] });
  });

  it("answers unavailable when every line is still buyable", async () => {
    const checkout = createLocalCheckout(
      catalogWith([
        { id: 201, inStock: true },
        { id: 202, inStock: true },
      ]),
    );

    const outcome = await checkout.startCheckout({
      lines: [lineFor(201), lineFor(202)],
    });

    expect(outcome).toEqual({
      status: "unavailable",
      reason: CHECKOUT_UNAVAILABLE_REASON,
    });
  });

  it("answers unavailable for an empty cart, having no line to reject", async () => {
    const checkout = createLocalCheckout(catalogWith([{ id: 201, inStock: true }]));

    const outcome = await checkout.startCheckout({ lines: [] });

    expect(outcome).toEqual({
      status: "unavailable",
      reason: CHECKOUT_UNAVAILABLE_REASON,
    });
  });

  // A module singleton reaching for the catalog would make this impossible:
  // the catalog cannot be imported from client code at all (design D1), and
  // the closure is simultaneously the seam this test stands on.
  it("answers from the catalog it was built with, not a shared one", async () => {
    const cart = { lines: [lineFor(201)] };
    const stocked = createLocalCheckout(catalogWith([{ id: 201, inStock: true }]));
    const sold = createLocalCheckout(catalogWith([{ id: 201, inStock: false }]));

    expect(await stocked.startCheckout(cart)).toMatchObject({ status: "unavailable" });
    expect(await sold.startCheckout(cart)).toMatchObject({ status: "rejected" });
  });
});
