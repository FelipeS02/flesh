import type { CartState } from "../domain/reducer";

type EmptyStateProps = {
  state: CartState;
};

/**
 * The cart with zero lines — tasks 3a.1/3a.2, amended by Engram obs #248.
 *
 * Takes the whole `CartState`, not a `lines: []` flag, because narrowing on
 * `status` first is the only thing the discriminated union lets a caller do
 * at all: `state.lines` does not exist on the `hydrating` member, so this
 * condition is the only one that compiles. A cart nobody has read yet is not
 * empty, it is UNKNOWN — announcing "Tu carrito esta vacio" over three
 * stored lines the visitor cannot see yet would be a lie with the face of
 * authority, which is exactly what the union exists to make impossible
 * (design D4 / obs #248).
 *
 * No discount summary and no CTA render here on purpose (spec "Empty cart
 * state"): there is nothing to total and nothing to check out.
 */
export function EmptyState({ state }: EmptyStateProps) {
  if (state.status !== "ready" || state.lines.length !== 0) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
      {/* ASCII-only: display-font Spanish copy cannot carry accents (spec
          "Checkout and empty-state copy is ASCII-only"; Kraut's measured
          `unicode-range` has no Latin-1 accented block). */}
      <p className="font-display text-2xl text-foreground md:text-3xl">
        Tu carrito esta vacio
      </p>
    </div>
  );
}
