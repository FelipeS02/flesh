import type { ProductView } from "@/modules/catalog";

export type VolumeGroup = {
  /** Stable identity for keys and anchors, e.g. `"drop-1"`. */
  key: string;
  /**
   * The heading a group renders, e.g. `"Volumen I"` — or `null` for products
   * that carry no drop tag, which are shown without a heading rather than
   * hidden.
   */
  title: string | null;
  products: ProductView[];
};

/** `drop-1`, `drop-2`, ... — the tag Tiendanube carries the volume in. */
const DROP_TAG = /^drop-(\d+)$/i;

// Only what the brand can plausibly ship before this becomes someone's
// problem again. Beyond the table the number is printed as-is rather than
// guessed at — "Volumen 11" is honest, an invented numeral is not.
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * Buckets the catalogue into drop volumes.
 *
 * The landing renders FROM this grouping even while a single volume exists,
 * which is the whole point: adding Volumen II later adds a titled group to an
 * existing structure instead of forcing the landing to be rewritten around an
 * interleaved list. A lone volume still renders untitled — one heading over
 * the only group on the page names nothing.
 *
 * Group order is the drop number, never input order: the catalogue arrives in
 * whatever order the source hands it over, and a volume's position on the
 * page is not that source's decision to make.
 */
export function groupByVolume(products: ProductView[]): VolumeGroup[] {
  const byKey = new Map<string, VolumeGroup>();

  for (const product of products) {
    const drop = dropNumberOf(product);
    const key = drop === null ? "" : `drop-${drop}`;

    const group = byKey.get(key) ?? {
      key,
      title: drop === null ? null : `Volumen ${roman(drop)}`,
      products: [],
    };
    group.products.push(product);
    byKey.set(key, group);
  }

  // Untitled products sort last: they are the ones whose volume nobody
  // declared, so they cannot claim a position among the ones who did.
  return [...byKey.values()].sort(
    (a, b) => dropNumberOfKey(a.key) - dropNumberOfKey(b.key),
  );
}

function dropNumberOf(product: ProductView): number | null {
  for (const tag of product.tags) {
    const match = DROP_TAG.exec(tag);
    if (match) {
      return Number.parseInt(match[1]!, 10);
    }
  }
  return null;
}

function dropNumberOfKey(key: string): number {
  return key === "" ? Number.POSITIVE_INFINITY : Number.parseInt(key.slice(5), 10);
}

function roman(value: number): string {
  return ROMAN_NUMERALS[value - 1] ?? String(value);
}
