"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Catalogo", href: "/#catalogo" },
  { label: "Instagram", href: "https://www.instagram.com/flesh.athletics/" },
  { label: "Devolucion", href: "/devoluciones" },
  {
    label: "Playlist",
    href: "https://open.spotify.com/playlist/3UAamrU7cnusH3qizK9wsv?si=e6d80b910a7e40c9",
  },
] as const;

/** True for absolute http(s) URLs — everything else (`/#catalogo`, `#`) is internal. */
function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

function internalPathname(href: string): string {
  return href.split(/[?#]/, 1)[0] || "/";
}

/**
 * Four-item nav.
 *
 * Single DOM list, styled entirely by CSS — no duplicated items for mobile
 * vs desktop. All four items stay on ONE row at every width. The earlier
 * mobile 2+2 split needed `flex-wrap` plus an invisible `basis-full` break
 * item, and the second row it produced made the footer tall enough to crowd
 * the viewport on short phones. A tighter `gap-x-1` below `md` buys that
 * room instead, so the wrap machinery is deleted rather than left disabled.
 */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal">
      <ul className="flex items-center justify-center gap-x-1 md:gap-x-6.5">
        {NAV_ITEMS.map((item) => {
          const external = isExternalHref(item.href);
          const active = !external && pathname === internalPathname(item.href);

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-display text-[22px] md:text-4xl",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
