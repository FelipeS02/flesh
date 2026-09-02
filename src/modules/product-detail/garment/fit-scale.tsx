import { cn } from "@/lib/utils";
import type { FitPosition } from "./cuts";

type FitScaleProps = {
  fit: FitPosition;
};

/** The scale's three stops, left to right — the order IS the semantics. */
const STOPS: { position: FitPosition; label: string; marker: string }[] = [
  // The end stops sit flush rather than centred on the track's edge: a 10px
  // marker centred on 0% hangs half of itself outside the line it belongs to.
  { position: "slim", label: "Slim", marker: "left-0" },
  { position: "true", label: "True to size", marker: "left-1/2 -translate-x-1/2" },
  { position: "baggy", label: "Baggy", marker: "right-0" },
];

/**
 * Where this garment's pattern sits between slim and baggy.
 *
 * Sync server component: a marker on a line has nothing to react to. It is
 * rendered beside the purchase panel rather than inside it precisely so it
 * stays on the server — the panel is a client component, and static garment
 * copy has no business crossing that boundary.
 *
 * The fit comes from the product's CUT (see `./cuts.ts`), which is also where
 * the size table comes from, so the scale and the measurements can never tell
 * a shopper two different stories.
 */
export function FitScale({ fit }: FitScaleProps) {
  const current = STOPS.find((stop) => stop.position === fit) ?? STOPS[1]!;

  return (
    <div role="group" aria-label="Fit" className="flex w-full flex-col gap-3.5">
      <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        Fit
      </p>

      {/* The line and the marker are decoration: the reading of this control
          is the stop named below, which is why the scale is announced in
          words and this row is hidden from assistive tech. */}
      <div aria-hidden="true" className="relative flex h-2.5 items-center">
        <span className="block h-px w-full bg-border" />
        <span
          data-fit-marker
          className={cn("absolute block size-2.5 bg-foreground", current.marker)}
        />
      </div>

      <div className="flex font-sans text-[9px] tracking-control md:text-[10px]">
        {STOPS.map((stop, index) => (
          <span
            key={stop.position}
            className={cn(
              "flex-1",
              index === 1 && "text-center",
              index === 2 && "text-right",
              // The marked stop is the one piece of information here, so it
              // is the one that is not muted.
              stop.position === fit ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {stop.label}
          </span>
        ))}
      </div>
    </div>
  );
}
