import type { ProductView, VariantView } from "./product";

/**
 * A shopper's in-progress choice, indexed by axis exactly like
 * `ProductView.axes`. `null` means "not chosen yet". Positional, mirroring
 * the wire's own model — a synthetic key would be one more thing that can
 * desync (see design decision 2).
 */
export type Selection = ReadonlyArray<string | null>;

/**
 * Three states, not two: the reference PDP DISPLAYS sold-out options rather
 * than hiding them, so a value that exists but cannot be bought must be
 * distinguishable from one that was never offered.
 */
export type AxisValueState = "available" | "soldOut" | "nonexistent";

export type AxisValueView = { value: string; state: AxisValueState };

/**
 * The only part of a product these selectors read.
 *
 * Narrower than `ProductView` on purpose: the PDP's purchase panel is a client
 * component, and handing it the whole product would serialise
 * `descriptionHtml` into the RSC payload a second time for nothing. A
 * `ProductView` still satisfies this structurally, so every server-side caller
 * keeps passing one unchanged.
 */
export type VariantMatrix = Pick<ProductView, "axes" | "variants">;

/**
 * Computes, for every value of one axis, whether picking it would lead to a
 * buyable variant given what is already selected on the OTHER axes.
 *
 * Linear scan per call, deliberately: ≤3 axes x a handful of variants makes
 * an index map pure ceremony at this scale.
 */
export function deriveAxisStates(
  product: VariantMatrix,
  selection: Selection,
  axisIndex: number,
): AxisValueView[] {
  const axis = product.axes[axisIndex];
  if (!axis) {
    return [];
  }

  return axis.values.map((value) => {
    const candidates = product.variants.filter(
      (variant) =>
        variant.combination[axisIndex] === value &&
        matchesOtherAxes(variant, selection, axisIndex),
    );

    if (candidates.length === 0) {
      return { value, state: "nonexistent" };
    }

    return {
      value,
      state: candidates.some((variant) => variant.inStock)
        ? "available"
        : "soldOut",
    };
  });
}

/**
 * Returns the variant matching a COMPLETE selection, or `null` while any axis
 * is still unchosen. A zero-axis product resolves its single variant from an
 * empty selection, so price and stock still have something to read.
 */
export function resolveVariant(
  product: VariantMatrix,
  selection: Selection,
): VariantView | null {
  // Both guards are needed: `some(null)` catches a chosen-but-incomplete
  // selection, the length check catches one that never had a slot for every
  // axis at all. Without it, `every` over a short selection matches on the
  // entries present and resolves an arbitrary variant.
  if (selection.length !== product.axes.length) {
    return null;
  }
  if (selection.some((value) => value === null)) {
    return null;
  }

  return (
    product.variants.find((variant) =>
      selection.every((value, index) => variant.combination[index] === value),
    ) ?? null
  );
}

/**
 * The axis being derived is excluded on purpose: constraining on it would
 * make every value other than the current one look `nonexistent`, freezing
 * the selector at whatever was picked first.
 */
function matchesOtherAxes(
  variant: VariantView,
  selection: Selection,
  axisIndex: number,
): boolean {
  return selection.every(
    (selected, index) =>
      index === axisIndex ||
      selected === null ||
      variant.combination[index] === selected,
  );
}
