import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type ColourwayIndex,
  type ColourwayLink,
  colourwayLinks,
  formatMoney,
  type ProductView,
} from "@/modules/catalog";
import { DiscountBadge } from "./discount-badge";
import { transferPrice } from "./pricing";
import { cardBadge } from "./product-state";
import { StateBadge } from "./state-badge";

type ProductCardProps = {
  product: ProductView;
  /**
   * The whole catalogue's colour groups. Required rather than optional: a
   * card that silently drew no swatches because a caller forgot to pass them
   * is the exact failure this data went looking for in the first place.
   */
  colourways: ColourwayIndex;
};

/**
 * One garment on the landing. Sync server component: nothing here reacts to
 * a click, because choosing a variant is the PDP's job — the card shows the
 * default variant's price and which colourways the drop came in.
 */
export function ProductCard({ product, colourways }: ProductCardProps) {
  const variant =
    product.variants.find((candidate) => candidate.id === product.defaultVariantId) ??
    product.variants[0];
  const image = product.images[0];
  const href = `/producto/${product.slug}`;
  const badge = cardBadge(product, variant);
  const soldOut = !product.inStock;

  return (
    <article className="flex w-full max-w-sm flex-col gap-3 md:w-75.25 md:max-w-none md:gap-5">
      {image && (
        // The badge is a SIBLING of the link, not a child: the link is
        // `aria-hidden`, and a badge buried inside it would be the one thing
        // on the card a screen reader could not reach.
        <div className="relative">
          {/* The image links to the same place the title does, so it is hidden
              from assistive tech and from the tab order rather than announced
              as a second, identically-named link to the same product. Its
              `alt` is empty for the same reason: the title below already names
              it. */}
          <Link
            href={href}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-43/50 md:aspect-auto md:h-85"
          >
            {/* Mobile keeps the artboard's 172x200 card-to-image proportion as
                a ratio rather than a fixed height, because the card is now as
                wide as the viewport allows instead of a fixed 172px. */}
            <Image
              src={image.src}
              alt=""
              fill
              sizes="(min-width: 768px) 301px, 100vw"
              className={cn("object-contain", soldOut && "opacity-40")}
            />
          </Link>

          {badge && (
            <div data-card-badge className="absolute top-3 left-3">
              {badge.kind === "state" ? (
                <StateBadge state={badge.state} />
              ) : (
                <DiscountBadge percent={badge.percent} />
              )}
            </div>
          )}
        </div>
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
            <span className="flex items-baseline gap-2 font-display text-base text-muted-foreground md:text-[22px]">
              {formatMoney(variant.price)}
              {/* `<s>` and not a strikethrough class, for the same reason the
                  PDP uses one: the original price is factually no longer
                  correct, which is what the element means. The percentage is
                  NOT repeated here — it is already the badge over the photo,
                  and saying it twice on a 301px card is saying it once too
                  many. */}
              {variant.compareAt && (
                <s className="text-xs md:text-base">
                  {formatMoney(variant.compareAt)}
                </s>
              )}
            </span>
            {/* Wraps rather than switching at a breakpoint: the label only
                fits beside the price when the card is wide enough, and how
                wide the card is depends on the column count, not on the
                viewport. A 17-character label letterspaced at 0.18em next to
                a 22px price needs more room than a narrow card has. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
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

        <SwatchRow
          links={colourwayLinks(colourways, product)}
          currentSlug={product.slug}
        />
      </div>
    </article>
  );
}

type SwatchRowProps = {
  links: ColourwayLink[];
  currentSlug: string;
};

/**
 * The colourway row: one dot per colour the design comes in.
 *
 * Every dot but the current one is a LINK, because a colour is its own
 * product here — separate photographs, separate stock, separate page. The
 * current colour is drawn ringed and inert: it is where you already are, and
 * a link back to the page you are on is a link that promises a change and
 * delivers none.
 *
 * The fill is the merchant's own hex, never guessed from the colour's name.
 * And colour is never the only channel: each dot carries its name, and a
 * sold-out one says so, for screen readers and for anyone who cannot tell two
 * dark swatches apart.
 */
function SwatchRow({ links, currentSlug }: SwatchRowProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <ul data-swatch-row className="flex items-center gap-2" aria-label="Colores">
      {links.map((link) => (
        <li
          key={link.slug}
          className={cn(
            "flex size-4.5 items-center justify-center rounded-full",
            link.slug === currentSlug && "ring-1 ring-inset ring-foreground",
          )}
        >
          {link.slug === currentSlug ? (
            <Dot link={link} />
          ) : (
            <Link href={`/producto/${link.slug}`} className="flex">
              <Dot link={link} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function Dot({ link }: { link: ColourwayLink }) {
  return (
    <>
      <span className="relative block size-3 rounded-full border border-border">
        <span
          className={cn(
            "block size-full rounded-full",
            !link.inStock && "opacity-40",
          )}
          style={{ backgroundColor: link.hex }}
        />
        {!link.inStock && (
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
        {link.inStock ? link.name : `${link.name} — agotado`}
      </span>
    </>
  );
}
