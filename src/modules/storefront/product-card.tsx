import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  deriveAxisStates,
  formatMoney,
  type ProductView,
  type Selection,
} from "@/modules/catalog";
import { transferPrice } from "./pricing";
import { findSwatchAxis, swatchColor } from "./swatches";

type ProductCardProps = {
  product: ProductView;
};

/**
 * One garment on the landing. Sync server component: nothing here reacts to
 * a click, because choosing a variant is the PDP's job — the card shows the
 * default variant's price and which colourways the drop came in.
 */
export function ProductCard({ product }: ProductCardProps) {
  const variant =
    product.variants.find((candidate) => candidate.id === product.defaultVariantId) ??
    product.variants[0];
  const image = product.images[0];
  const href = `/producto/${product.slug}`;

  return (
    <article className="flex w-43 flex-col gap-3 md:w-75.25 md:gap-5">
      {/* The image links to the same place the title does, so it is hidden
          from assistive tech and from the tab order rather than announced as
          a second, identically-named link to the same product. Its `alt` is
          empty for the same reason: the title below already names it. */}
      {image && (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block h-50 md:h-85"
        >
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(min-width: 768px) 301px, 172px"
            className="object-contain"
          />
        </Link>
      )}

      <div className="flex flex-col gap-4">
        {/* The card's own heading level, not the page's: the volume section
            above owns h2, so a card cannot claim it without breaking the
            outline for anyone navigating by headings.

            No reserved title height: the artboard fixes it at 58px so that
            two-line titles keep every card's price on the same baseline, but
            with the short titles the catalogue actually carries that reads as
            a hole above the price. Cards with titles of different lengths
            will now misalign their price rows. */}
        <h3 className="font-display text-lg leading-[1.15] text-primary md:text-2xl">
          <Link href={href}>{product.title}</Link>
        </h3>

        {variant && (
          <div className="flex flex-col gap-px md:gap-0.5">
            <span className="font-display text-base text-muted-foreground md:text-[22px]">
              {formatMoney(variant.price)}
            </span>
            {/* Stacked on mobile, side by side from md. The artboard draws
                one row at both sizes, but 172px of card cannot hold a 22px
                price beside a 17-character label letterspaced at 0.18em —
                pen.dev does not wrap, so the overflow is invisible there. */}
            <div className="flex flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-2">
              <span className="font-display text-[22px] text-foreground md:text-3xl">
                {formatMoney(transferPrice(variant.price))}
              </span>
              {/* Copperplate Gothic is an all-caps face, so the artboard's
                  uppercase is the FONT — not a text-transform to add here. */}
              <span className="font-sans text-[10px] tracking-control text-muted-foreground md:text-xs">
                Con transferencia
              </span>
            </div>
          </div>
        )}

        <SwatchRow product={product} />
      </div>
    </article>
  );
}

/**
 * The colourway row. Renders nothing at all unless an axis is made entirely
 * of known colours — see `findSwatchAxis`.
 *
 * Colour is never the only channel: each dot carries its colour name, and a
 * sold-out one says so, both for screen readers and for anyone who cannot
 * tell two dark swatches apart.
 */
function SwatchRow({ product }: ProductCardProps) {
  const axis = findSwatchAxis(product);
  if (!axis) {
    return null;
  }

  const unselected: Selection = product.axes.map(() => null);
  const values = deriveAxisStates(product, unselected, axis.index);
  const selected = product.variants.find(
    (variant) => variant.id === product.defaultVariantId,
  )?.combination[axis.index];

  return (
    <ul data-swatch-row className="flex items-center gap-2" aria-label={axis.label}>
      {values.map(({ value, state }) => (
        <li
          key={value}
          className={cn(
            "flex size-4.5 items-center justify-center rounded-full",
            value === selected && "ring-1 ring-inset ring-foreground",
          )}
        >
          <span className="relative block size-3 rounded-full border border-border">
            <span
              className={cn(
                "block size-full rounded-full",
                state === "soldOut" && "opacity-40",
              )}
              style={{ backgroundColor: swatchColor(value) ?? undefined }}
            />
            {state === "soldOut" && (
              <svg
                viewBox="0 0 12 12"
                aria-hidden="true"
                className="absolute inset-0 size-full text-muted-foreground"
              >
                <line
                  x1="1.5"
                  y1="10.5"
                  x2="10.5"
                  y2="1.5"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="sr-only">
            {state === "soldOut" ? `${value} — agotado` : value}
          </span>
        </li>
      ))}
    </ul>
  );
}
