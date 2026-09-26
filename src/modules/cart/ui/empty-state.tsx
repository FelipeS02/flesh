import Link from "next/link";
import type { CartState } from "../domain/reducer";

type EmptyStateProps = {
  state: CartState;
  /**
   * Closes the drawer, and it is REQUIRED rather than optional on purpose.
   *
   * The drawer is an overlay sitting over the very catalogue this component
   * points at, so a CTA that navigates without closing lands the shopper on
   * the drop with the cart still covering it. Made optional, that is a bug a
   * caller can introduce by simply not thinking about it; made required, the
   * type system asks the question at every call site.
   */
  onBrowse: () => void;
};

/**
 * Where the CTA sends a shopper with nothing in the cart.
 *
 * The landing's product area, by the same anchor the header nav uses (see
 * `DropCatalog`) rather than a route of its own — there is no catalogue page
 * to send anyone to, and inventing a URL here would create a second answer to
 * "where do the clothes live".
 */
const CATALOG_HREF = "/#catalogo";

/**
 * The cart with zero lines — tasks 3a.1/3a.2, amended by Engram obs #248.
 *
 * Takes the whole `CartState`, not a `lines: []` flag, because narrowing on
 * `status` first is the only thing the discriminated union lets a caller do
 * at all: `state.lines` does not exist on the `hydrating` member, so this
 * condition is the only one that compiles. A cart nobody has read yet is not
 * empty, it is UNKNOWN — announcing "Tu carrito está vacío" over three
 * stored lines the visitor cannot see yet would be a lie with the face of
 * authority, which is exactly what the union exists to make impossible
 * (design D4 / obs #248).
 *
 * Closing is INJECTED rather than taken from the sheet's own `SheetClose`.
 * That component reads Base UI's dialog context and throws without it, which
 * would make this one unrenderable outside a drawer — including in its own
 * tests. A callback keeps the component presentational and the behaviour
 * where the state already lives.
 */
export function EmptyState({ state, onBrowse }: EmptyStateProps) {
  if (state.status !== "ready" || state.lines.length !== 0) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="font-display text-2xl text-foreground md:text-3xl">
        Tu carrito está vacío
      </p>

      {/* Cased in the source and uppercased in CSS, not typed in capitals: a
          screen reader given "VOLUMEN" may spell it out letter by letter,
          while `text-transform` changes only what is painted. */}
      <p className="max-w-64 font-sans text-[11px] leading-relaxed tracking-control text-muted-foreground uppercase">
        Todavía no elegiste ninguna pieza del Volumen I
      </p>

      <Link
        href={CATALOG_HREF}
        onClick={onBrowse}
        className="mt-4 flex h-12 w-full items-center justify-center bg-foreground font-display text-lg text-background transition-opacity hover:opacity-90 md:h-14 md:text-xl"
      >
        Ver el drop
      </Link>
    </div>
  );
}
