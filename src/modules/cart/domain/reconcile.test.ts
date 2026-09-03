import { describe, expect, it } from "vitest";
import { makeProduct, makeVariant } from "../../../../test/fixtures/product-view";
import { indexCartCatalog, toCartCatalog } from "./catalog-projection";
import { reconcile, type StoredCart } from "./reconcile";

function buildStored(overrides: Partial<StoredCart> = {}): StoredCart {
  return {
    lines: [],
    notices: [],
    ...overrides,
  };
}

describe("reconcile", () => {
  it("removes an out-of-stock line and emits a named removed notice", () => {
    const catalog = toCartCatalog([
      makeProduct({
        id: 101,
        title: "Musculosa Demon Wash Black",
        variants: [makeVariant({ id: 201, combination: ["M"], inStock: false })],
      }),
    ]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [{ productId: 101, variantId: 201, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" }],
    });

    const result = reconcile(stored, index);

    expect(result.lines).toEqual([]);
    expect(result.notices).toEqual([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Musculosa Demon Wash Black / M" },
    ]);
  });

  it("removes a line whose variant no longer exists and emits an unnamed removed notice", () => {
    const catalog = toCartCatalog([makeProduct({ id: 101, variants: [makeVariant({ id: 201 })] })]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [{ productId: 999, variantId: 555, quantity: 1, unitPriceMinor: 1_000, currency: "ARS" }],
    });

    const result = reconcile(stored, index);

    expect(result.lines).toEqual([]);
    expect(result.notices).toEqual([
      { kind: "removed", reason: "unknown-variant", variantId: 555, item: null },
    ]);
  });

  it("reprices a line whose catalog price changed and emits a before/after notice", () => {
    const catalog = toCartCatalog([
      makeProduct({
        id: 101,
        title: "Musculosa Demon Wash Black",
        variants: [
          makeVariant({ id: 201, combination: ["M"], price: { amount: 3_000_000, currency: "ARS" } }),
        ],
      }),
    ]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [{ productId: 101, variantId: 201, quantity: 2, unitPriceMinor: 2_700_000, currency: "ARS" }],
    });

    const result = reconcile(stored, index);

    expect(result.lines).toEqual([
      { productId: 101, variantId: 201, quantity: 2, price: { amount: 3_000_000, currency: "ARS" } },
    ]);
    expect(result.notices).toEqual([
      {
        kind: "repriced",
        variantId: 201,
        item: "Musculosa Demon Wash Black / M",
        from: { amount: 2_700_000, currency: "ARS" },
        to: { amount: 3_000_000, currency: "ARS" },
      },
    ]);
  });

  it("keeps an untouched line silent when nothing drifted", () => {
    const catalog = toCartCatalog([makeProduct({ id: 101, variants: [makeVariant({ id: 201 })] })]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [{ productId: 101, variantId: 201, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" }],
    });

    const result = reconcile(stored, index);

    expect(result.lines).toEqual([
      { productId: 101, variantId: 201, quantity: 1, price: { amount: 2_700_000, currency: "ARS" } },
    ]);
    expect(result.notices).toEqual([]);
  });

  it("handles out-of-stock, unknown-variant, and reprice together in one cart", () => {
    const catalog = toCartCatalog([
      makeProduct({
        id: 101,
        title: "Producto A",
        variants: [makeVariant({ id: 201, combination: ["M"], inStock: false })],
      }),
      makeProduct({
        id: 102,
        title: "Producto B",
        variants: [
          makeVariant({ id: 203, combination: ["L"], price: { amount: 5_000_00, currency: "ARS" } }),
        ],
      }),
    ]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [
        { productId: 101, variantId: 201, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" },
        { productId: 999, variantId: 555, quantity: 1, unitPriceMinor: 1_000, currency: "ARS" },
        { productId: 102, variantId: 203, quantity: 1, unitPriceMinor: 4_500_00, currency: "ARS" },
      ],
    });

    const result = reconcile(stored, index);

    expect(result.lines).toEqual([
      { productId: 102, variantId: 203, quantity: 1, price: { amount: 5_000_00, currency: "ARS" } },
    ]);
    expect(result.notices).toEqual([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Producto A / M" },
      { kind: "removed", reason: "unknown-variant", variantId: 555, item: null },
      {
        kind: "repriced",
        variantId: 203,
        item: "Producto B / L",
        from: { amount: 4_500_00, currency: "ARS" },
        to: { amount: 5_000_00, currency: "ARS" },
      },
    ]);
  });

  it("merges a still-pending persisted notice with a freshly-detected one, keyed by variantId", () => {
    const catalog = toCartCatalog([makeProduct({ id: 101, variants: [makeVariant({ id: 201 })] })]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [],
      notices: [
        { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
      ],
    });

    const result = reconcile(stored, index);

    // No lines drifted this time, but the notice from the PREVIOUS
    // rehydration must survive — that is the whole point of D3/D4: a
    // notice outlives the reload that produced it, until dismissed.
    expect(result.notices).toEqual([
      { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
    ]);
  });

  it("lets a fresh notice win over a stale persisted one for the same variantId", () => {
    const catalog = toCartCatalog([
      makeProduct({
        id: 101,
        title: "Musculosa Demon Wash Black",
        variants: [makeVariant({ id: 201, combination: ["M"], inStock: false })],
      }),
    ]);
    const index = indexCartCatalog(catalog);
    const stored = buildStored({
      lines: [{ productId: 101, variantId: 201, quantity: 1, unitPriceMinor: 2_700_000, currency: "ARS" }],
      notices: [
        {
          kind: "repriced",
          variantId: 201,
          item: "stale label",
          fromMinor: 1,
          toMinor: 2,
          currency: "ARS",
        },
      ],
    });

    const result = reconcile(stored, index);

    // The variant went out of stock since the stale notice was recorded —
    // the fresh out-of-stock notice must replace it, not sit beside it.
    expect(result.notices).toEqual([
      { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Musculosa Demon Wash Black / M" },
    ]);
  });
});

describe("reconcile — threat matrix: forged stored payload", () => {
  it("treats an unknown variantId as an opaque lookup key only, never fs/path/network reachable", () => {
    // reconcile.ts imports nothing but plain domain types — no `fs`, no
    // `path`, no network client is even reachable from this module, so an
    // injected id can only ever miss a `Map.get` call. This test proves the
    // OBSERVABLE half of that guarantee: a hostile value produces exactly
    // the unnamed removal notice and nothing else, for a range of shapes a
    // real attacker might smuggle through a hand-edited localStorage entry.
    const catalog = toCartCatalog([makeProduct({ id: 101, variants: [makeVariant({ id: 201 })] })]);
    const index = indexCartCatalog(catalog);

    const hostileVariantIds = [
      -1,
      0,
      Number.MAX_SAFE_INTEGER,
      // A string masquerading as a numeric id — the Zod schema (PR2a) is
      // what actually rejects this at the storage boundary; here we prove
      // reconcile itself does not need that guard to stay safe, because it
      // never does anything with the value except look it up.
      "../../../../etc/passwd" as unknown as number,
    ];

    for (const variantId of hostileVariantIds) {
      const stored = buildStored({
        lines: [{ productId: 999, variantId, quantity: 1, unitPriceMinor: 1, currency: "ARS" }],
      });

      const result = reconcile(stored, index);

      expect(result.lines).toEqual([]);
      expect(result.notices).toEqual([
        { kind: "removed", reason: "unknown-variant", variantId, item: null },
      ]);
    }
  });
});
