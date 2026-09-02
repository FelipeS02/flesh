import type { OptionAxis, Selection } from "@/modules/catalog/client";

/**
 * The variant selection lives in the URL's query string (`?talle=m&color=noir`),
 * and this module is the whole translation between that string and the
 * positional `Selection` the domain speaks.
 *
 * Both directions are deliberately lossy in the same way: a param that names
 * no value of its axis resolves to "unchosen" rather than throwing. The query
 * string is user-editable and link-shareable, so a stale or hand-typed value
 * is an expected input, not a contract violation.
 */

/**
 * The query-param key for each axis, positionally aligned with `axes`.
 *
 * Derived from the merchant's own label rather than a hardcoded axis name:
 * a product may carry any of three axes with any labels, so a fixed `color`/
 * `size` vocabulary would only work for the products we happen to have today.
 */
export function axisParamKeys(axes: readonly OptionAxis[]): string[] {
  const taken = new Map<string, number>();

  return axes.map((axis, position) => {
    const base = slugify(axis.label) || `opcion-${position + 1}`;
    const seen = taken.get(base) ?? 0;

    taken.set(base, seen + 1);
    // Second and later collisions are numbered from 2, so the first axis to
    // claim a key keeps the clean one and existing links stay valid.
    return seen === 0 ? base : `${base}-${seen + 1}`;
  });
}

/**
 * Reads a raw query record into a `Selection`.
 *
 * The returned entries are the values as the MERCHANT typed them ("Noir", not
 * "noir"), because everything downstream — `deriveAxisStates`, `resolveVariant`
 * — compares against `variant.combination`, which carries the merchant's
 * casing. Matching here rather than at every call site keeps the URL's
 * lowercase convention from leaking into the domain.
 */
export function selectionFromQuery(
  axes: readonly OptionAxis[],
  query: Readonly<Record<string, string | null | undefined>>,
): Selection {
  const keys = axisParamKeys(axes);

  return axes.map((axis, position) => {
    const raw = query[keys[position]!];
    if (raw == null) {
      return null;
    }

    const wanted = normalize(raw);
    return axis.values.find((value) => normalize(value) === wanted) ?? null;
  });
}

/** The query-string form of an option value — the inverse of the match above. */
export function paramValue(value: string): string {
  return normalize(value);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Diacritics are stripped rather than percent-encoded: a merchant labelling an
 * axis "Tamaño" should still produce a link a person can read and retype.
 */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
