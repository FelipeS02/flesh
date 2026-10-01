import { cn } from "@/lib/utils";
import { STOCK_GLYPH_FRAMES } from "./stock-glyph-frames";

/** How long each frame owns the stage. */
const FRAME_MS = 140;
/** How long the crossfade between two frames takes. */
const FADE_MS = 90;

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
        "flex items-center gap-2  font-sans text-[11px] tracking-control text-primary md:text-[13px]",
        className,
      )}
    >
      <StockGlyph />
      <span className='leading-4'>Última unidad disponible</span>
    </p>
  );
}

/**
 * The frame cycle for a sequence of `count` frames.
 *
 * Generated rather than written into `globals.css` because its percentages
 * depend on the count: a frame owns `1 / count` of the loop, and its fade-out
 * is the SAME wall-clock span as the next frame's fade-in, so the swap is a
 * crossfade with no empty instant between skulls. A fixed keyframe written
 * for four frames left gaps at three and overlaps at six.
 *
 * The animation rule and its reduced-motion override live here too, not in
 * Tailwind classes on the element: the duration depends on the count as well,
 * and an inline `animation` would beat `motion-reduce:animate-none`.
 */
export function stockGlyphKeyframes(count: number): string {
  // One frame has nothing to cycle to; it simply stays up (see StockGlyph).
  if (count < 2) return "";

  const loop = count * FRAME_MS;
  const slot = 1 / count;
  const fade = FADE_MS / loop;
  const at = (fraction: number) => `${Number((fraction * 100).toFixed(3))}%`;
  const name = `stock-glyph-frame-${count}`;
  const frames = `[data-stock-glyph="${count}"]>svg`;

  return (
    `@keyframes ${name}{0%{opacity:0}${at(fade)},${at(slot)}{opacity:1}${at(slot + fade)},100%{opacity:0}}` +
    `${frames}{animation:${name} ${loop}ms ease-out infinite}` +
    `@media (prefers-reduced-motion:reduce){${frames}{animation:none}}`
  );
}

/**
 * The skull loop: every frame in `STOCK_GLYPH_FRAMES`, stacked, each taking
 * its turn on stage. Its own `<svg>` per frame, so each can fade on its own.
 *
 * Reduced motion keeps the first frame and drops the loop entirely — a skull
 * that flickers is exactly the kind of motion that setting exists to stop.
 */
function StockGlyph() {
  // Widened from the tuple's literal length so the one-frame case below
  // still type-checks after someone trims the sequence down to one.
  const count: number = STOCK_GLYPH_FRAMES.length;
  const loop = count * FRAME_MS;

  return (
    <span data-stock-glyph={count} aria-hidden="true" className="relative size-4 shrink-0 md:size-5">
      {/* `href` + `precedence` let React hoist this into <head> once, however
          many glyphs render — the panel and the mobile widget both draw one. */}
      <style href={`stock-glyph-${count}`} precedence="default">
        {stockGlyphKeyframes(count)}
      </style>
      {STOCK_GLYPH_FRAMES.map((d, index) => (
        <svg
          key={index}
          viewBox="0 0 200 200"
          className={cn(
            "absolute inset-0 size-full fill-current text-foreground",
            index === 0 ? "opacity-0 motion-reduce:opacity-100" : "opacity-0",
            count === 1 && "opacity-100",
          )}
          // Negative, so every frame is already at its point in the loop on
          // first paint; a positive delay would leave the glyph blank until
          // frame 1's own fade-in had finished.
          style={{ animationDelay: `${index === 0 ? 0 : index * FRAME_MS - loop}ms` }}
        >
          <path d={d} />
        </svg>
      ))}
    </span>
  );
}
