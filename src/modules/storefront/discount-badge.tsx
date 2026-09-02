import { cn } from "@/lib/utils";

type DiscountBadgeProps = {
  /** Whole percent off the original price — see `discountPercent`. */
  percent: number;
  className?: string;
};

/**
 * How far a price has been marked down.
 *
 * Shared by the catalogue card and the PDP because it is one claim, and a
 * second copy would be a second place for the red to drift. WHERE it goes
 * differs by surface and is each surface's own decision: on a card it takes
 * the badge slot over the photo, because the price there is small and the card
 * is competing in a grid; on the PDP it sits against the price, which by then
 * is the thing being read.
 *
 * Never used for the transfer discount. That one is a price you can still
 * choose to pay, not a markdown that already happened.
 */
export function DiscountBadge({ percent, className }: DiscountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-primary px-2 py-1 font-sans text-[10px] tracking-control text-primary-foreground tabular-nums md:text-[11px]",
        className,
      )}
    >
      {/* Split so the reading is a sentence. "-30%" is a label a sighted
          reader takes in beside a struck price; alone, out of that context,
          it is not one. */}
      <span aria-hidden="true">-{percent}%</span>
      <span className="sr-only">{percent}% de descuento</span>
    </span>
  );
}
