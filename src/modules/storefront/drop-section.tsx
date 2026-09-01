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
 * The cards sit in a plain centred row, not a grid: the drop is two or three
 * garments, and a grid would promise columns that never fill. On mobile they
 * stack one per row — a deliberate departure from the artboard, which draws
 * two 172px cards side by side there.
 */
export function DropSection({ group, titled }: DropSectionProps) {
  const heading = titled ? group.title : null;

  return (
    <section
      aria-label={group.title ?? undefined}
      className="flex flex-col items-center gap-5 md:gap-8"
    >
      {heading && (
        <h2 className="font-display text-2xl text-foreground md:text-4xl">
          {heading}
        </h2>
      )}
      {/* `items-center` centres the stack horizontally on mobile; from md the
          same property would centre the cards against EACH OTHER vertically,
          so a card with a swatch row would drag its shorter neighbour's title
          out of line. Cards hang from the top of the row instead. */}
      <div className="flex w-full flex-col items-center gap-10 md:w-auto md:flex-row md:items-start md:justify-center md:gap-14">
        {group.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
