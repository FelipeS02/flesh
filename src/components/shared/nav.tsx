import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Catalogo", href: "/#catalogo" },
  { label: "Instagram", href: "https://www.instagram.com/flesh.athletics/" },
  // TODO(flesh-storefront/5b.3): destination genuinely undecided by the
  // user — do not invent a URL for "Devolucion" until it is resolved.
  { label: "Devolucion", href: "#" },
  {
    label: "Playlist",
    href: "https://open.spotify.com/playlist/3UAamrU7cnusH3qizK9wsv?si=e6d80b910a7e40c9",
  },
] as const;

/** True for absolute http(s) URLs — everything else (`/#catalogo`, `#`) is internal. */
function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * Four-item nav. Sync server component.
 *
 * Single DOM list, styled entirely by CSS — no duplicated items for mobile
 * vs desktop. Mobile splits into two visual rows (2 + 2); rather than two
 * hardcoded row elements, a single invisible break item forces the wrap
 * deterministically after the 2nd item on mobile only (`md:hidden`
 * `basis-full`). Text-width-based `flex-wrap` was rejected: with variable
 * label lengths it cannot reliably reproduce the exact 2+2 split across
 * viewports/font metrics — the forced-break item gives the same single-DOM
 * benefit without that fragility.
 */
export function Nav() {
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6.5">
        {NAV_ITEMS.map((item, index) => {
          const external = isExternalHref(item.href);

          return (
            <Fragment key={item.label}>
              <li>
                <Link
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={cn(
                    "font-display text-[22px] md:text-4xl",
                    index === 0 ? "text-primary" : "text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
              {index === 1 && (
                <li aria-hidden="true" className="basis-full md:hidden" />
              )}
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
