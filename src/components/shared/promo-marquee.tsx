import FleshLogo from '@/components/shared/flesh-logo';
import { TRANSFER_RATE_BP } from '@/modules/catalog/client';

/**
 * What the band says, in the order it says it.
 *
 * The discount is DERIVED, not written: `TRANSFER_RATE_BP` is the same basis
 * point figure `transferPrice` charges by, so the banner and the price it
 * advertises cannot drift apart. A literal "10%" here would be a second home
 * for one brand policy, and the first one to go stale.
 */
const MESSAGES = [
  `${TRANSFER_RATE_BP / 100}% off extra transferencias`,
  '3 y 6 cuotas',
  "ADRENALINA YA DISPONIBLE"
] as const;

/**
 * How many times one lane says the whole thing.
 *
 * The seam below is a -50% travel across two identical lanes, which means one
 * lane has to be at least as wide as the band it is filling — past that point
 * the track simply runs out of copy and leaves the right of the screen empty.
 * A single pass of `MESSAGES` measures ~485px: fine on a 390px phone, and
 * about a third of a laptop, which is exactly how this shipped broken.
 *
 * Six passes is ~2900px, which covers a 2560px display with room left. The
 * cost is 24 spans of static markup, paid once at render.
 */
export const MARQUEE_REPEATS = 6;

/** Seconds for one pass of `MESSAGES` to cross a given point — the SPEED. */
const SECONDS_PER_PASS = 20;

/**
 * Derived, never written down.
 *
 * The animation always travels exactly one lane, so a lane carrying six times
 * the copy takes six times as long to do it at the same speed. Tying the two
 * together here is what stops `MARQUEE_REPEATS` from secretly being a speed
 * control — raise it for coverage and the band would otherwise sprint.
 */
const DRIFT_SECONDS = MARQUEE_REPEATS * SECONDS_PER_PASS;

/**
 * The promotional band above the wordmark.
 *
 * It collapses as you scroll, and it does so against the SAME
 * `--header-scroll-progress` the header already publishes — which is the
 * reason this component lives inside the header's sticky band rather than
 * beside it. A second scroll listener for a second element on the same
 * scroll is two clocks to keep in sync, and they only ever disagree in
 * production.
 *
 * Height and opacity both fall to zero over the header's own range. The band
 * centres its content (`items-center`) instead of anchoring it, so a shrinking
 * band clips the copy symmetrically — anchored to the top, the glyphs get
 * beheaded on the way out and it reads as a rendering fault rather than a
 * transition.
 */
export function PromoMarquee() {
  return (
    <div
      data-promo-marquee
      // The `,0` fallback matters: the progress variable is written by the
      // header's effect, so it is absent for the one paint before hydration
      // and in any test that renders this on its own. Without it `calc()`
      // is invalid and the band collapses to auto height.
      className='flex h-[calc(var(--_marquee-height)*(1-var(--header-scroll-progress,0)))] items-center overflow-hidden opacity-[calc(1-var(--header-scroll-progress,0))] [--_marquee-height:1.875rem] mask-x-from-90%'
    >
      <div
        data-marquee-track
        // The duration is inline because it is COMPUTED from the repeat
        // count, and Tailwind can only emit class names it can see at build
        // time. The class keeps the name, easing and iteration count, so
        // `motion-reduce:animate-none` still wins the way a class should —
        // it blanks the animation name, and a duration with nothing to drive
        // is inert.
        style={{ animationDuration: `${DRIFT_SECONDS}s` }}
        // Two identical lanes travelling exactly one lane-width: -50% of the
        // track IS one lane, which is what makes the loop seamless rather
        // than jumping at the wrap. It also means one lane must be WIDER than
        // the band — see `MARQUEE_REPEATS`.
        //
        // `motion-reduce` is not decoration here. Copy that moves on its own
        // and never stops is WCAG 2.2.2's own example of what needs a way
        // out, and for a band this small, stopping is the honest one.
        className='flex shrink-0 animate-[promo-marquee-drift_linear_infinite] motion-reduce:animate-none'
      >
        <Lane />
        <Lane duplicate />
      </div>
    </div>
  );
}

/**
 * One pass of the copy.
 *
 * The duplicate exists for the seam and carries nothing new, so it is hidden
 * from assistive technology — otherwise every promise on the band is read out
 * twice to the one visitor who cannot see that it is the same band scrolling.
 */
function Lane({ duplicate }: { duplicate?: boolean }) {
  return (
    <div
      data-marquee-lane
      aria-hidden={duplicate || undefined}
      // The right padding is part of the lane, not a gap on the track: the
      // -50% above measures the track, so spacing that lives between the two
      // lanes would make the wrap land short.
      className='flex shrink-0 items-center gap-6 pr-6 font-sans text-[9px] tracking-control whitespace-nowrap text-muted-foreground md:text-[10px]'
    >
      {Array.from({ length: MARQUEE_REPEATS }, (_, pass) =>
        MESSAGES.map((message) => (
          <span
            key={`${pass}-${message}`}
            className='flex shrink-0 items-center gap-4'
          >
            {message}
            {/* The separator is the FLESH mark rather than a dash — it is a
                mark of ownership on the band, not punctuation asking to be
                read. It inherits `currentColor`, which is the whole reason
                the logo stopped hardcoding its own fill. */}
            <FleshLogo className='size-3 shrink-0 text-primary' />
          </span>
        )),
      )}
    </div>
  );
}
