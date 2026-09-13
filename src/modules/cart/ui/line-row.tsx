'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { formatMoney, purchaseLimit } from '@/modules/catalog/client';
import { DiscountBadge } from '@/modules/storefront/discount-badge';
import { promoPriceView } from '@/modules/storefront/pricing';
import { indexCartCatalog } from '../domain/catalog-projection';
import type { CartLine } from '../domain/line';
import { useCartEnvironment } from '../state/cart-context';
import { RemoveLineButton } from './remove-line-button';
import { Stepper } from './stepper';

type LineRowProps = {
  line: CartLine;
};

/**
 * One line in the drawer — title, colour/size combination, and current
 * price, all three read from the live `CartCatalog` (design D1/D3), NEVER
 * from `line` itself. `CartLine` carries no title or combination at all:
 * only `productId` / `variantId` / `quantity` and a price WITNESS meant for
 * drift detection, never for display (see `domain/line.ts`'s own header
 * comment). Looking the variant up here — rather than accepting display data
 * as props — makes reading a stale or persisted copy a compile error, not a
 * discipline a future caller has to remember.
 */
export function LineRow({ line }: LineRowProps) {
  const { catalog } = useCartEnvironment();
  const index = useMemo(() => indexCartCatalog(catalog), [catalog]);
  const entry = index.get(line.variantId);

  // Not reachable through the product in normal operation: `reconcile`
  // removes a line the moment its variant is missing from the catalog,
  // before the provider ever holds it (design D4). Rendering nothing is the
  // honest answer if it somehow still happens.
  if (!entry) {
    return null;
  }

  const { product, variant } = entry;
  const combination = variant.combination.join(', ');
  const price = promoPriceView(variant.price, variant.compareAt);
  const limit = purchaseLimit(variant);

  // Laid out to the `Cart Items / Promocion` artboard (option B), whose
  // arrangement is load-bearing rather than decorative: the two things a
  // shopper acts on — change how many, or drop it — sit at opposite corners
  // of the row, so neither is clicked by accident while reaching for the
  // other. Everything the row STATES (name, size, price) reads down the
  // middle; everything it OFFERS sits on the outside.
  return (
    <div className='flex items-start gap-4 border-b border-border py-4'>
      {product.image && (
        // `alt=""`: the title beside it already names the garment, the same
        // rule `ProductCard`'s own image follows. Portrait 92x106 from the
        // artboard, not a square — these are full-length studio shots of
        // clothing, and a square crop cuts the garment off at the hem.
        <div className='relative h-26.5 w-23 shrink-0'>
          <Image
            src={product.image}
            alt=''
            fill
            sizes='92px'
            className='object-contain'
          />
        </div>
      )}
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        {/* Title row: the garment, and the one control that discards it. */}
        <div className='flex items-start justify-between gap-3'>
          <p className='min-w-0 font-sans text-base text-foreground truncate leading-4'>
            {product.title}
          </p>
          <RemoveLineButton line={line} />
        </div>

        {combination && (
          <p className='font-sans text-xs text-muted-foreground'>
            {combination}
          </p>
        )}

        {/* Bottom row: quantity on the left, money on the right. The price
            cell is the ONLY thing a promotion changes (option B) — the row
            itself is never marked, so a discounted line still reads as one
            line among the others rather than as an advertisement. */}
        <div className='mt-2 flex items-end justify-between gap-3'>
          <Stepper line={line} limit={limit} />
          <div className='flex flex-col items-end'>
            {(price.previous || price.percent !== null) && (
              <span className='flex items-center gap-2'>
                {/* `<s>` for the same reason `PriceBlock` uses it: the
                    previous price is factually no longer correct, and
                    assistive tech should announce it as such rather than as
                    decoration. */}
                {price.percent !== null && (
                  <DiscountBadge
                    className='bg-transparent p-0 text-primary'
                    percent={price.percent}
                  />
                )}
                {price.previous && (
                  <s className='font-sans text-xs text-muted-foreground'>
                    {formatMoney(price.previous)}
                  </s>
                )}
              </span>
            )}
            <p className='font-sans text-lg tabular-nums text-foreground'>
              {formatMoney(price.current)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
