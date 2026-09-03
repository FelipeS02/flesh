import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ColourwayLink } from "@/modules/catalog/client";

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
 */
export function ColourwaySelector({ links, currentSlug }: ColourwaySelectorProps) {
  if (links.length === 0) {
    return null;
  }

  const current = links.find((link) => link.slug === currentSlug);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        <span>Seleccionar Color</span>
        {/* A dot cannot say its own name, so the row prints the current one
            beside the label — the same rule the size boxes do not need,
            because a box already shows the value it carries. */}
        {current && <span className="text-foreground">{current.name}</span>}
      </p>

      <ul aria-label="Colores" className="flex items-center gap-2.5">
        {links.map((link) => (
          <li key={link.slug}>
            {link.slug === currentSlug ? (
              <span
                aria-current="true"
                className="flex size-12.5 items-center justify-center rounded-full ring-1 ring-inset ring-foreground"
              >
                <Swatch link={link} />
                <span className="sr-only">{link.name}</span>
              </span>
            ) : (
              <Link
                href={`/producto/${link.slug}`}
                className={cn(
                  "flex size-12.5 items-center justify-center rounded-full",
                  // A sold-out colour stays reachable on purpose: its page
                  // carries the photographs and the sizes, and telling someone
                  // they cannot even LOOK at it is a harsher answer than the
                  // page itself gives.
                  !link.inStock && "opacity-40",
                )}
              >
                <Swatch link={link} />
                <span className="sr-only">
                  {link.inStock ? link.name : `${link.name} — agotado`}
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Swatch({ link }: { link: ColourwayLink }) {
  return (
    <span
      className="block size-10 rounded-full border border-border"
      style={{ backgroundColor: link.hex }}
    />
  );
}
