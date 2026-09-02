import { formatMoney, type VariantView } from "@/modules/catalog/client";
import { transferPrice } from "@/modules/storefront/pricing";

type PriceBlockProps = {
  variant: VariantView;
};

/**
 * The PDP's price, in the artboard's two rows: the transfer price leads
 * because it is what most of this drop's buyers actually pay, and the list
 * price sits under it in muted type.
 *
 * `transferPrice` is imported from the storefront module rather than
 * duplicated: the 10% is one brand policy with one home (`pricing.ts`), and a
 * second copy here would be a second place to forget when it changes.
 */
export function PriceBlock({ variant }: PriceBlockProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-display text-3xl text-foreground md:text-[38px]">
          {formatMoney(transferPrice(variant.price))}
        </span>
        {/* Copperplate Gothic is an all-caps face, so the artboard's uppercase
            is the FONT — not a text-transform to add here. */}
        <span className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
          Con transferencia
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-baseline gap-2 font-display text-base text-muted-foreground md:text-[21px]">
          {formatMoney(variant.price)}
          {/* `<s>` and not a strikethrough class: the original price is
              factually no longer correct, which is exactly what the element
              means, and assistive tech announces it as such. */}
          {variant.compareAt && (
            <s className="text-[13px] text-muted-foreground md:text-[18px]">
              {formatMoney(variant.compareAt)}
            </s>
          )}
        </span>
        <span className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
          3 y 6 cuotas sin interes
        </span>
      </div>
    </div>
  );
}
