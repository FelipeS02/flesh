import type { ProductView } from "@/modules/catalog";
import { DropSection } from "./drop-section";
import { groupByVolume } from "./volume";

type DropCatalogProps = {
  products: ProductView[];
};

/**
 * The landing's product area, and the target of the nav's "Catalogo" link.
 *
 * Grouping lives here rather than in `page.tsx` on purpose: the page is the
 * one async boundary in the app and therefore the one place Vitest cannot
 * reach, so every decision worth testing — which volumes exist, whether they
 * name themselves — has to sit below it.
 */
export function DropCatalog({ products }: DropCatalogProps) {
  const volumes = groupByVolume(products);

  return (
    <div id="catalogo" className="flex flex-col items-center gap-12 md:gap-20">
      {volumes.map((volume) => (
        <DropSection
          key={volume.key}
          group={volume}
          titled={volumes.length > 1}
        />
      ))}
    </div>
  );
}
