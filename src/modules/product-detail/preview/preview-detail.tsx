import type { ProductView } from '@/modules/catalog';
import { LaunchNotifyForm } from '@/modules/newsletter/client';
import { productState } from '@/modules/storefront/product-state';
import { StateBadge } from '@/modules/storefront/state-badge';
import { PreviewGallery } from './preview-gallery';

type PreviewDetailProps = {
  product: ProductView;
};

/**
 * The PDP of a product that cannot be bought yet: gallery, title and the
 * launch form, stacked and centred so the whole of it fits one viewport below
 * the header, with nothing to scroll to reach the button.
 *
 * No price, sizes or cart, and no purchase widget; `StageMetrics` tolerates
 * the widget's absence and the gallery's height budget reads its band only.
 * The badge is the storefront's own, so one product wears one mark on its
 * card and on its page.
 */
export function PreviewDetail({ product }: PreviewDetailProps) {
  return (
    // `justify-center` over a top margin: `main` already takes the height left
    // under the header, so the block sits visually centred in it at any
    // viewport height, where a fixed margin only looked right at one.
    <main className='mx-auto flex w-full flex-1 flex-col items-center justify-center'>
      {/* The -mx-4 undoes the page wrapper's mobile gutter so the neighbouring
          slides can bleed to the screen edge. */}
      <div className='-mx-4 w-[calc(100%+2rem)] md:mx-0 md:w-full'>
        <PreviewGallery
          images={product.images}
          title={product.title}
          badge={<StateBadge state={productState(product)} />}
        />
      </div>

      <h1 className='mt-3 text-center font-display text-[32px] leading-[1.05] text-primary md:mt-4 md:text-[40px]'>
        {product.title}
      </h1>

      <div className='mt-3 w-full max-w-100 md:mt-4'>
        <LaunchNotifyForm productId={product.id} />
      </div>
    </main>
  );
}
