import type { CSSProperties } from "react";
import { balancedColumns } from "./columns";
import { ProductCard } from "./product-card";
import type { VolumeGroup } from "./volume";

type DropSectionProps = {
  group: VolumeGroup;
  /**
   * Whether the volume names itself. False while the drop is the only one on
   * the page — a heading over the single group there names nothing.
   */
  titled: boolean;
};

/**
 * One volume of the drop. Sync server component.
 *
 * From `md` the cards sit in a grid whose column count is COMPUTED from how
 * many there are, so the rows come out even. On mobile they stack one per row
 * — a deliberate departure from the artboard, which draws two 172px cards side
 * by side there.
 */
export function DropSection({ group, titled }: DropSectionProps) {
  const heading = titled ? group.title : null;
  const columns = balancedColumns(group.products.length);

  // The section's own `w-full` is load-bearing. Its parent centres its
  // children, and centring shrinks an unsized section to its content — so
  // without it the cards' `w-full` resolves against that shrunken width
  // rather than the page, and the column renders about half as wide as the
  // viewport allows. Invisible on desktop, where cards are a fixed 301px.

  return (
    <section
      aria-label={group.title ?? undefined}
      className="flex w-full flex-col items-center gap-5 md:gap-8"
    >
      {heading && (
        <h2 className="font-display text-2xl text-foreground md:text-4xl">
          {heading}
        </h2>
      )}
      {/* A GRID from md, not a wrapping row. A wrapped flex row fills each
          line to capacity before breaking, so six cards land as 4 + 2 and the
          short second row reads as a layout that ran out. The column count is
          computed instead — see `balancedColumns`.

          `items-start` keeps cards hanging from the top of their row, so a
          card with a swatch row cannot drag a shorter neighbour's title out of
          line. `justify-items-center` centres each 301px card in its cell,
          which is what keeps a last row of two sitting under the middle of a
          row of three rather than against the left edge.

          Mobile stays a single centred stack — one card per row was PR6b's own
          departure from the artboard's 2-up. */}
      <div
        data-drop-row
        // The count is data, so it arrives as a CSS variable rather than as a
        // class name: Tailwind generates classes by scanning source text, and
        // a `md:grid-cols-${columns}` it never sees written down is a class it
        // never emits. The arbitrary property below is written out in full, so
        // it IS scanned, and only the value varies.
        className="flex w-full flex-col items-center gap-10 md:grid md:max-w-360 md:items-start md:justify-items-center md:grid-cols-[repeat(var(--drop-columns),minmax(0,1fr))] md:gap-14"
        style={{ "--drop-columns": columns } as CSSProperties}
      >
        {group.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
