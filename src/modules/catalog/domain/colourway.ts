import type { ProductView } from "./product";

/**
 * A garment's OWN colourway, as the merchant fills it into Tiendanube's
 * product custom field.
 *
 * A product describes itself and nothing else. The sibling colours of the
 * same design are found by matching `group` — never by a list of sibling
 * links copied into each product. Copied links rot: Tiendanube appends a
 * random suffix to every handle (`…-letras-y-cruz-1a523`), so a hand-typed
 * sibling URL is one rename away from a 404, in a field nothing validates.
 * Adding a colour is then one edit instead of one per existing colour.
 */
export type Colourway = {
  /** Shared verbatim by every colour of the same design. */
  group: string;
  /**
   * The swatch fill, supplied by the merchant. Never derived from the colour
   * NAME: a guessed swatch misrepresents the garment being sold, and the
   * merchant is the only one who knows what the dye actually looks like.
   */
  hex: string;
  /** The colour's name — the channel for anyone who cannot see the dot. */
  name: string;
};

/** One dot in a swatch row: a sibling colour and the page it lives on. */
export type ColourwayLink = {
  hex: string;
  name: string;
  slug: string;
  inStock: boolean;
};

export type ColourwayIndex = ReadonlyMap<string, ColourwayLink[]>;

/**
 * Groups a catalogue by colourway.
 *
 * Must be fed EVERY product, not just the listed ones. Secondary colours are
 * `unlisted` in Tiendanube precisely so they keep a page without claiming a
 * second card in the grid — which means the siblings a swatch row needs are
 * exactly the products `getProducts()` filters out.
 *
 * Insertion order is preserved so a row of dots reads the same on every
 * build; the merchant's catalogue order is the only ordering anyone here has
 * a right to.
 */
export function buildColourwayIndex(
  products: readonly ProductView[],
): ColourwayIndex {
  const index = new Map<string, ColourwayLink[]>();

  for (const product of products) {
    if (!product.colourway) {
      continue;
    }

    const { group, hex, name } = product.colourway;
    const links = index.get(group) ?? [];
    links.push({ hex, name, slug: product.slug, inStock: product.inStock });
    index.set(group, links);
  }

  return index;
}

/**
 * The swatch row for one product — its own colour included, so the row reads
 * identically on every colour's page and the current one can be marked rather
 * than missing.
 *
 * A group of one returns nothing: a single dot names no choice, and drawing
 * it would tell the shopper there is a decision to make when there is not.
 */
export function colourwayLinks(
  index: ColourwayIndex,
  product: ProductView,
): ColourwayLink[] {
  if (!product.colourway) {
    return [];
  }

  const links = index.get(product.colourway.group) ?? [];
  return links.length > 1 ? links : [];
}
