import type { OptionAxis, ProductView } from "@/modules/catalog";

/**
 * The drop's colourway names, mapped to the swatch fills sampled from the
 * artboards. Keys are lowercased option VALUES as the merchant types them in
 * Tiendanube — the Spanish aliases are here because the wire data uses them
 * interchangeably with the brand's own French/English names.
 *
 * Unregistered colours are deliberately not guessed: a wrong swatch is worse
 * than no swatch, since it misrepresents the garment being sold.
 */
const SWATCH_COLORS: Record<string, string> = {
  noir: "#0A0A0A",
  negro: "#0A0A0A",
  bone: "#E8E4DA",
  hueso: "#E8E4DA",
};

/** The swatch fill for an option value, or `null` if it names no known colour. */
export function swatchColor(value: string): string | null {
  return SWATCH_COLORS[value.trim().toLowerCase()] ?? null;
}

/**
 * Finds the axis a card can draw as colour dots.
 *
 * Detection is by VALUE, never by the axis label: the label is merchant-typed
 * free text ("Color", "Colour", "Tono"), so matching on it would be a
 * hardcoded axis name in disguise — the exact thing the selector design bans.
 * An axis qualifies only when every one of its values resolves to a colour,
 * so a half-known axis renders no swatches instead of a row with holes in it.
 */
export function findSwatchAxis(product: ProductView): OptionAxis | null {
  return (
    product.axes.find(
      (axis) =>
        axis.values.length > 0 &&
        axis.values.every((value) => swatchColor(value) !== null),
    ) ?? null
  );
}
