/**
 * The one-line name of a variant for the restock form: "NEGRO · M".
 *
 * The colourway is a separate PRODUCT in this catalogue, not an axis, so it
 * is not part of the variant's `combination`; prepending it is what makes the
 * line describe the garment the shopper is actually looking at. Upper-cased
 * here, and not by CSS, because the same string is read back inside sentences
 * ("Cuando entre NEGRO · M te escribimos…") where a style would not follow it.
 */
export function restockVariantLine(
  colourwayName: string | null,
  combination: readonly string[],
): string {
  const seen = new Set(combination.map((value) => value.toLocaleLowerCase("es-AR")));
  const parts =
    colourwayName && !seen.has(colourwayName.toLocaleLowerCase("es-AR"))
      ? [colourwayName, ...combination]
      : [...combination];

  return parts.map((part) => part.toLocaleUpperCase("es-AR")).join(" · ");
}
