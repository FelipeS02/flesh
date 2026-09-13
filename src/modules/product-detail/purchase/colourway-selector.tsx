import type { ColourwayLink } from "@/modules/catalog/client";
import { ColourwaySwatches } from "./colourway-swatches";

type ColourwaySelectorProps = {
  links: ColourwayLink[];
  currentSlug: string;
};

/**
 * The colour choice on the PDP.
 *
 * A SERVER component, and deliberately not part of `PurchasePanel`: picking a
 * colour here is not a selection, it is a NAVIGATION. Each colour is its own
 * product with its own photographs, stock and page, so the control is a row of
 * links rather than state — which keeps it out of the client bundle and inside
 * the prerendered HTML, where a crawler can follow it.
 *
 * Sizes remain in the panel, where they belong: those genuinely are a choice
 * within this page.
 *
 * The row itself lives in `ColourwaySwatches` because the mobile widget draws
 * the same colours in a smaller box. This component is what wraps them in the
 * label that names the current one.
 */
export function ColourwaySelector({ links, currentSlug }: ColourwaySelectorProps) {
  if (links.length === 0) {
    return null;
  }

  const current = links.find((link) => link.slug === currentSlug);

  return (
    <div className="flex flex-col">
      <p className="flex items-center gap-2 font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        <span>Seleccionar Color</span>
        {/* A dot cannot say its own name, so the row prints the current one
            beside the label — the same rule the size boxes do not need,
            because a box already shows the value it carries. */}
        {current && <span className="text-foreground">{current.name}</span>}
      </p>

      <ColourwaySwatches links={links} currentSlug={currentSlug} />
    </div>
  );
}
