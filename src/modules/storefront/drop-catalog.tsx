import type { ColourwayIndex, ProductView } from '@/modules/catalog';
import { CatalogViewTracker } from '@/modules/analytics';
import { DropSection } from './drop-section';
import { groupByVolume } from './volume';

type DropCatalogProps = {
  products: ProductView[];
  /**
   * Passed down rather than read here: this component is sync and the index
   * is fetched, and the page is already the app's one async boundary.
   */
  colourways: ColourwayIndex;
};

/**
 * The landing's product area, and the target of the nav's "Catalogo" link.
 *
 * Grouping lives here rather than in `page.tsx` on purpose: the page is the
 * one async boundary in the app and therefore the one place Vitest cannot
 * reach, so every decision worth testing — which volumes exist, whether they
 * name themselves — has to sit below it.
 */
export function DropCatalog({ products, colourways }: DropCatalogProps) {
  const volumes = groupByVolume(products);

  return (
    <>
      <CatalogViewTracker products={products} />
      {volumes.map((volume, index) => (
        <DropSection
          key={volume.key}
          group={volume}
          titled={volumes.length > 1}
          colourways={colourways}
          // Only the first volume can have cards above the fold, and only it
          // is allowed to ask for them eagerly. Every later volume is below
          // by construction, so its photos wait for the viewport.
          leading={index === 0}
          // On the first volume only: an `id` must be unique, and `/#catalogo`
          // (nav, empty cart, product 404) should land where the drop starts.
          id={index === 0 ? 'catalogo' : undefined}
        />
      ))}
    </>
  );
}
