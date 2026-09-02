import type { OptionAxis, ProductView } from "@/modules/catalog/client";

/**
 * Garment cuts — the pattern a product is made from.
 *
 * This is CONTENT, not commerce data, and it deliberately lives in the repo:
 * Tiendanube's Product entity carries price, stock, weight and options, and
 * nothing that describes how a garment is cut. Inventing a wire field for it
 * would break the one rule the catalog module is built on — the mock is
 * faithful to the real contract, so the live swap is a swap.
 *
 * The tag names the PATTERN, never the sensation. `corte-remera-oversize`, not
 * `fit-oversize`: "oversize" describes how a garment feels, and an oversize
 * tee and an oversize hoodie share that word and not one centimetre. A tag
 * that names the feeling cannot key a measurement table — it is one-to-many,
 * and the second garment type silently gets the first one's numbers.
 *
 * Because both the fit scale and the size table hang off the pattern, they
 * cannot disagree: there is one source, not two.
 */

/** `corte-remera-oversize`, `corte-buzo-boxy`, ... — anchored like `drop-N`. */
const CUT_TAG = /^corte-(.+)$/i;

/**
 * Where a cut sits on the PDP's fit scale, as a percentage of the travel from
 * slim (0) to oversized (100).
 *
 * A CONTINUUM, not three buckets. An earlier version of this modelled it as
 * `"slim" | "true" | "baggy"`, and that was wrong: a gently relaxed tee and an
 * extremely dropped one are both "baggy" and are not the same garment. The
 * three labels the scale prints are its legend — the axis you read the mark
 * against — not the set of values a cut may take.
 */
export type FitPosition = number;

export type Measurement = {
  /** Row label on the size table, e.g. "Largo". */
  label: string;
  /** Size value -> centimetres. Keys are the merchant's own size tokens. */
  bySize: Record<string, number>;
};

export type GarmentCut = {
  /** The tag's value, e.g. `"remera-oversize"`. */
  key: string;
  /** 0 = slim, 50 = true to size, 100 = oversized. Anything in between. */
  fit: FitPosition;
  measurements: Measurement[];
};

/**
 * Every pattern the drop is cut from. One entry today: the three Volumen I
 * products share a single tee block.
 *
 * Measurements are in centimetres, garment-flat, as the brand measures them.
 * `S` is listed even though the drop currently opens at M — the table is the
 * PATTERN's truth, and the PDP renders only the rows for sizes actually on
 * sale, so a size coming back in stock needs no edit here.
 */
export const CUTS: Record<string, GarmentCut> = {
  "remera-oversize": {
    key: "remera-oversize",
    // Relaxed, not extreme — the brand's own read on its block. The whole
    // reason this is a number: "oversize" alone could mean 65 or 95.
    fit: 65,
    measurements: [
      { label: "Largo", bySize: { S: 63, M: 68, L: 73, XL: 78 } },
      { label: "Ancho", bySize: { S: 52, M: 56, L: 61, XL: 65 } },
      { label: "Mangas", bySize: { S: 40, M: 44, L: 47, XL: 49 } },
    ],
  },
};

/** The sizes a cut has measurements for, in table order. */
export function sizesOf(cut: GarmentCut): string[] {
  return Object.keys(cut.measurements[0]?.bySize ?? {});
}

/**
 * The cut a product is made from, or `null` when we cannot say.
 *
 * Tolerant like `groupByVolume`, never a guess: no tag, an unregistered
 * pattern, or TWO cut tags all resolve to nothing. Two tags is the important
 * one — it means two measurement tables, and choosing either is inventing an
 * answer nobody gave. A wrong swatch merely disappoints; a wrong measurement
 * comes back as a return.
 */
export function findGarmentCut(product: Pick<ProductView, "tags">): GarmentCut | null {
  const keys = product.tags
    .map((tag) => CUT_TAG.exec(tag.trim())?.[1]?.toLowerCase())
    .filter((key): key is string => key !== undefined);

  if (keys.length !== 1) {
    return null;
  }

  return CUTS[keys[0]!] ?? null;
}

// Letter sizing only, which is what this brand sells. Numeric sizing (waist,
// EU shoe) would need its own token rule rather than an entry here.
const SIZE_TOKENS = new Set([
  "xxs",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "2xl",
  "3xl",
]);

/**
 * The axis a size table describes.
 *
 * Detected by VALUE, never by the axis label — same rule `findSwatchAxis`
 * established, and for the same reason: the label is merchant-typed free text
 * ("Talle", "Tamaño", "Size"), so keying off it is a hardcoded axis name in
 * disguise. An axis qualifies only when EVERY value is a size, so a
 * half-matching axis describes nothing instead of describing it wrongly.
 */
export function findSizeAxis(product: Pick<ProductView, "axes">): OptionAxis | null {
  return (
    product.axes.find(
      (axis) =>
        axis.values.length > 0 &&
        axis.values.every((value) => SIZE_TOKENS.has(value.trim().toLowerCase())),
    ) ?? null
  );
}
