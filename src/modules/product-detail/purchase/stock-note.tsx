import { cn } from "@/lib/utils";
import { STOCK_GLYPH_FRAMES } from "./stock-glyph-frames";

/** One full pass over the four frames — 140ms each. */
const LOOP_MS = 560;
const FRAME_MS = LOOP_MS / STOCK_GLYPH_FRAMES.length;

/**
 * The scarcity line that sits directly above the add-to-cart button when the
 * chosen variant has exactly one unit left.
 *
 * Above the CTA rather than beside the size label: the size row is where the
 * shopper is still deciding, the button is where they decide, and a nudge is
 * only worth anything at the moment it can still change the decision.
 */
export function StockNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-sans text-[11px] tracking-control text-primary md:text-[13px]",
        className,
      )}
    >
      <StockGlyph />
      <span>Última unidad disponible</span>
    </p>
  );
}

/**
 * A four-frame skull loop, each frame crossfading in through a blur.
 *
 * Every frame is its own `<svg>` rather than a `<path>` inside one: CSS
 * `filter` on SVG child elements is not reliable across engines (Safari is
 * the usual holdout), while on an outer `<svg>` box it is plain HTML filtering
 * that every browser does.
 *
 * Reduced motion keeps frame 1 and drops the loop entirely — a skull that
 * flickers is exactly the kind of motion that setting exists to stop.
 */
function StockGlyph() {
  return (
    <span data-stock-glyph aria-hidden="true" className="relative size-4 shrink-0 md:size-5">
      {STOCK_GLYPH_FRAMES.map((d, index) => (
        <svg
          key={index}
          viewBox="0 0 200 200"
          className={cn(
            "absolute inset-0 size-full fill-current text-foreground opacity-0",
            "animate-[stock-glyph-frame_560ms_ease-out_infinite] motion-reduce:animate-none",
            index === 0 && "motion-reduce:opacity-100",
          )}
          // Negative, so every frame is already at its point in the loop on
          // first paint; a positive delay would leave the glyph blank until
          // frame 1's own fade-in had finished.
          style={{ animationDelay: `${index === 0 ? 0 : index * FRAME_MS - LOOP_MS}ms` }}
        >
          <path d={d} />
        </svg>
      ))}
    </span>
  );
}
