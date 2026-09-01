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
 * garments, and a grid would promise columns that never fill.
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
      <div className="flex justify-center gap-3.5 md:gap-14">
        {group.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
