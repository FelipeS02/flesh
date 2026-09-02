import { cn } from "@/lib/utils";
import type { ProductState } from "./product-state";

type StateBadgeProps = {
  /** `null` renders nothing — see `productState`. */
  state: ProductState | null;
  className?: string;
};

/**
 * How each state looks, straight off the `Catalog Card / Estados` artboard.
 *
 * Sold-out and featured share a shape and differ only in the colour of their
 * outline and label, which is the artboard's own decision: both are quiet
 * marks over a photo, and only the meaning changes. `new` is the loud one.
 */
const TREATMENT: Record<ProductState, { label: string; className: string }> = {
  // Labels in ordinary case. Copperplate Gothic is an all-caps face, so the
  // artboard's uppercase is the FONT — adding `uppercase` here would be a
  // second mechanism doing the same job, visible only when the font fails.
  new: { label: "Nuevo", className: "bg-secondary text-secondary-foreground" },
  featured: {
    label: "Destacado",
    className: "border border-foreground bg-black/80 text-foreground",
  },
  soldOut: {
    label: "Agotado",
    className: "border border-muted-foreground bg-black/80 text-muted-foreground",
  },
};

/**
 * The badge a product wears over its photo.
 *
 * It describes the GARMENT — new, picked out, gone. The discount badge is a
 * different thing living in a different place: it describes the PRICE, so it
 * sits against the price rather than over the image (see `PriceBlock`).
 */
export function StateBadge({ state, className }: StateBadgeProps) {
  if (!state) {
    return null;
  }

  const { label, ...treatment } = TREATMENT[state];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1.5 font-sans text-[10px] tracking-control md:text-[11px]",
        treatment.className,
        className,
      )}
    >
      {label}
    </span>
  );
}
