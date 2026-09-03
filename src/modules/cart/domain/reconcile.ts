import type { CartLineId } from "../api/port";
import type { CartCatalogProduct, CartCatalogVariant } from "./catalog-projection";
import type { CartLine, CartNotice } from "./line";

/**
 * The decoded shape of what `localStorage` held, BEFORE any catalog check.
 * Mirrors design D3's `StoredCartSchema`/`StoredNoticeSchema` field-for-field
 * so the Zod schema PR2a writes is a validation layer over this exact
 * shape, not a second definition of it. Kept here rather than importing
 * from a not-yet-existing `storage.ts`, so this pure module has zero
 * dependency on the Zod/localStorage adapter that will eventually produce
 * this value.
 *
 * `unitPriceMinor`/`currency` is the price WITNESS (design D3) — used only
 * for the drift comparison below, never for display or arithmetic once a
 * line is reconciled.
 */
export type StoredCartLine = {
  productId: number;
  variantId: CartLineId;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
};

export type StoredCartNotice =
  | { kind: "removed"; reason: "out-of-stock"; variantId: CartLineId; item: string }
  | { kind: "removed"; reason: "unknown-variant"; variantId: CartLineId; item: string | null }
  | {
      kind: "repriced";
      variantId: CartLineId;
      item: string;
      fromMinor: number;
      toMinor: number;
      currency: string;
    };

export type StoredCart = {
  lines: StoredCartLine[];
  notices: StoredCartNotice[];
};

type CatalogIndex = Map<CartLineId, { product: CartCatalogProduct; variant: CartCatalogVariant }>;

/**
 * Pure, synchronous, zero IO (design D4) — the effect that calls this does
 * the IO (reading storage, building `index` from the server-projected
 * catalog prop) and dispatches exactly one `rehydrate` action carrying this
 * result. Synchronous because the catalog was already resolved on the
 * server (D1); the proposal's async assumption belonged to a `CatalogPort`
 * call this design replaced.
 *
 * `index` is looked up ONLY by `Map.get` — never used to build a path, a
 * shell command, or a URL, so an unknown or hostile `variantId` can only
 * ever miss the lookup (see the threat-matrix test in `reconcile.test.ts`).
 */
export function reconcile(
  stored: StoredCart,
  index: CatalogIndex,
): { lines: CartLine[]; notices: CartNotice[] } {
  const lines: CartLine[] = [];
  const freshNotices: CartNotice[] = [];

  for (const storedLine of stored.lines) {
    const entry = index.get(storedLine.variantId);

    if (!entry) {
      // The catalog can supply no name for a variant it no longer knows —
      // D3 never persisted display data to fall back on either. Unnamed,
      // not silent: see the spec's "Rehydration reconciles" requirement.
      freshNotices.push({
        kind: "removed",
        reason: "unknown-variant",
        variantId: storedLine.variantId,
        item: null,
      });
      continue;
    }

    if (!entry.variant.inStock) {
      freshNotices.push({
        kind: "removed",
        reason: "out-of-stock",
        variantId: storedLine.variantId,
        item: describeLine(entry),
      });
      continue;
    }

    if (entry.variant.price.amount !== storedLine.unitPriceMinor) {
      freshNotices.push({
        kind: "repriced",
        variantId: storedLine.variantId,
        item: describeLine(entry),
        from: { amount: storedLine.unitPriceMinor, currency: storedLine.currency },
        to: entry.variant.price,
      });
    }

    lines.push({
      productId: storedLine.productId,
      variantId: storedLine.variantId,
      quantity: storedLine.quantity,
      price: entry.variant.price,
    });
  }

  return { lines, notices: mergeNotices(stored.notices, freshNotices) };
}

/**
 * `"<title> / <combination>"`, per design D4 — the catalog can rebuild this
 * exactly when `entry` exists, which is precisely when this is called (an
 * unknown variant never reaches here). A zero-axis product's empty
 * combination collapses to the title alone rather than a trailing " / ".
 */
function describeLine(entry: {
  product: CartCatalogProduct;
  variant: CartCatalogVariant;
}): string {
  const combination = entry.variant.combination.join(", ");
  return combination ? `${entry.product.title} / ${combination}` : entry.product.title;
}

/**
 * Fresh wins on a `variantId` collision — it describes the more recent
 * observation (design D4). Without this merge, a second reload before the
 * visitor ever opened the cart would silently wipe a notice they never saw,
 * exactly the failure D4 exists to close.
 */
function mergeNotices(persisted: StoredCartNotice[], fresh: CartNotice[]): CartNotice[] {
  const freshVariantIds = new Set(fresh.map((notice) => notice.variantId));
  const stillPending = persisted
    .filter((notice) => !freshVariantIds.has(notice.variantId))
    .map(toCartNotice);

  return [...stillPending, ...fresh];
}

/**
 * `removed` notices are already `CartNotice`-shaped once decoded — only
 * `repriced` needs its flattened minor-unit amounts rebuilt into `Money`.
 */
function toCartNotice(stored: StoredCartNotice): CartNotice {
  if (stored.kind === "repriced") {
    return {
      kind: "repriced",
      variantId: stored.variantId,
      item: stored.item,
      from: { amount: stored.fromMinor, currency: stored.currency },
      to: { amount: stored.toMinor, currency: stored.currency },
    };
  }

  return stored;
}
