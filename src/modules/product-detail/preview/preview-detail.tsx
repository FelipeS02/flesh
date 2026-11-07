import { LaunchNotifyForm } from '@/modules/newsletter/client';
import type { ProductView } from '@/modules/catalog';
import { productState } from '@/modules/storefront/product-state';
import { StateBadge } from '@/modules/storefront/state-badge';
import { PreviewCarousel } from './preview-carousel';

type PreviewDetailProps = {
  product: ProductView;
};

/**
 * The PDP of a product that cannot be bought yet ("Preview Centrada").
 *
 * It replaces the buy layout outright rather than hiding pieces of it: no
 * price, no sizes, no cart, and none of the purchase widget that
 * `StageMetrics` measures. The page therefore does not render `StageMetrics`
 * here either, since it has nothing to measure and would only bail out.
 *
 * The badge is the storefront's own, resolved here so one product wears one
 * mark on the card and on its page. `StateBadge` has no size variant, so on
 * mobile it keeps its 10px label (the design asks for 11 with 6/10 padding):
 * the difference is a pixel, and a second badge style is not worth it.
 */
export function PreviewDetail({ product }: PreviewDetailProps) {
  return (
    // The -mx-4 on the carousel undoes the page wrapper's mobile gutter so the
    // neighbouring slides can peek past it; the form and text put it back.
    <main className='mx-auto mb-10 flex w-full flex-1 flex-col items-center text-center md:mt-10'>
      <div className='-mx-4 w-[calc(100%+2rem)] md:mx-0 md:w-full'>
        <PreviewCarousel
          images={product.images}
          title={product.title}
          badge={<StateBadge state={productState(product)} />}
        />
      </div>

      <div className='flex w-full max-w-160 flex-col items-center gap-2.5 md:gap-3.5'>
        <h1 className='font-display text-[38px] leading-[1.05] text-primary md:text-[64px]'>
          {product.title}
        </h1>
        <p className='font-display text-2xl leading-none text-foreground md:text-[34px]'>
          Próximamente
        </p>
      </div>

      <div className='w-full max-w-130 px-1 pt-7 md:px-0 md:pt-10'>
        <LaunchNotifyForm productId={product.id} />
      </div>
    </main>
  );
}
