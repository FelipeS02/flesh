import FleshLogo from "@/components/shared/flesh-logo";
import { cn } from "@/lib/utils";
import type { FitPosition } from "./cuts";

type FitScaleProps = {
  /** 0 = slim, 50 = true to size, 100 = oversized. */
  fit: FitPosition;
};

/**
 * The scale's legend, left to right — the axis the mark is read against, NOT
 * the set of values a cut may take. A cut sits anywhere on the line between
 * them.
 */
const STOPS = ["Slim", "True to size", "Oversized"];

/**
 * Where this garment's pattern sits between slim and oversized.
 *
 * Sync server component: a marker on a line has nothing to react to. It is
 * rendered beside the purchase panel rather than inside it precisely so it
 * stays on the server — the panel is a client component, and static garment
 * copy has no business crossing that boundary.
 *
 * The fit comes from the product's CUT (see `./cuts.ts`), which is also where
 * the size table comes from, so the scale and the measurements can never tell
 * a shopper two different stories.
 *
 * No stop is highlighted. With a continuous value, emphasising the nearest
 * label would state a second, coarser reading that can disagree with the mark
 * — a 65 is not "true to size" and not quite "oversized", and the point of a
 * position on a line is that it does not have to round itself off.
 */
export function FitScale({ fit }: FitScaleProps) {
  // Clamped and rounded at the edge of the component rather than trusted:
  // content is hand-authored, and a value off the scale would drag the mark
  // off the line it is supposed to describe.
  const percent = Math.round(Math.min(100, Math.max(0, fit)));

  return (
    <div role="group" aria-label="Fit" className="flex w-full flex-col gap-3.5">
      <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        Fit
      </p>

      {/* The line and the mark are decoration; the reading a screen reader
          gets is the sentence at the end of this group. */}
      <div aria-hidden="true" className="relative flex h-2.5 items-center">
        <span className="block h-px w-full bg-border" />
        {/* The brand's cross stands in for the artboard's plain square. It is
            the mark the whole site is built around, and at this size it reads
            as a pin on the line rather than as a logo asking for attention.
            Centred on its own value, end positions included: the mark's box is
            mostly transparent, so the overhang costs nothing and the cross
            sits ON the value instead of beside it. */}
        <span
          data-fit-marker
          className="absolute top-1/2 block -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${percent}%` }}
        >
          <FleshLogo className="size-6" />
        </span>
      </div>

      <div className="flex font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        {STOPS.map((label, index) => (
          <span
            key={label}
            className={cn(
              "flex-1",
              index === 1 && "text-center",
              index === 2 && "text-right",
            )}
          >
            {label}
          </span>
        ))}
      </div>

      <span className="sr-only">
        {`Fit ${percent} de 100 en la escala de slim a oversized.`}
      </span>
    </div>
  );
}
