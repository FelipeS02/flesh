/**
 * The widest row the artboard's frame holds: four 301px cards with 56px
 * between them is 1372, inside a 1440 page.
 */
export const MAX_COLUMNS = 4;

/**
 * How many columns to lay a drop out in, so its rows come out even.
 *
 * Two rules, in order:
 *
 * 1. **Never add a row.** The layout uses the fewest rows the ceiling allows,
 *    always. Six products in three rows of two would be squarer than two rows
 *    of three, and it would also be wrong — a drop is meant to be seen at a
 *    glance, not scrolled.
 * 2. **Then even them out.** Among the column counts that still fit in those
 *    rows, take the one leaving the fewest empty cells at the end. Six at four
 *    columns is 4 + 2, and a short last row reads as a layout that ran out
 *    rather than one that was chosen; at three it is 3 + 3.
 *
 * Rule 1 is what stops the obvious formulation — "fewest holes" — from
 * collapsing to a single column, which trivially has no holes at all and is
 * also useless.
 */
export function balancedColumns(count: number, max: number = MAX_COLUMNS): number {
  if (count <= 1) {
    return 1;
  }

  const ceiling = Math.min(count, max);
  const rows = Math.ceil(count / max);
  const holesAt = (columns: number) => (columns - (count % columns)) % columns;

  let best = ceiling;

  // Ascending, replacing only on STRICTLY fewer holes, so a tie keeps the
  // narrower row — even columns of equal quality read calmer than wide ones.
  for (let columns = 1; columns <= ceiling; columns++) {
    if (Math.ceil(count / columns) !== rows) {
      continue;
    }

    if (holesAt(columns) < holesAt(best)) {
      best = columns;
    }
  }

  return best;
}
