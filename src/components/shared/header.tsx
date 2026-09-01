import Link from "next/link";
import FleshLogotype from "@/components/shared/flesh-logotype";

/**
 * Full-width shell header. Sync server component — no client interactivity.
 *
 * The 3-column grid (`1fr auto 1fr`) is load-bearing: only the middle column
 * is used here, on purpose. `flesh-cart` adds a cart trigger + badge to the
 * THIRD column later; since an empty grid track needs no DOM element, the
 * wordmark stays centered today without any placeholder markup to remove
 * when that PR lands.
 */
export function Header() {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center pt-7.5 md:pt-11">
      <Link
        href="/"
        aria-label="FLESH — inicio"
        className="col-start-2 justify-self-center"
      >
        {/* Width alone: the SVG carries `viewBox` with no width/height, so
            the height follows the 575:229 ratio at every breakpoint. */}
        <FleshLogotype className="w-28" />
      </Link>
    </header>
  );
}
