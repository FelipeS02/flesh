import { LaunchNotifyForm } from '@/modules/newsletter/client';

type PreviewNoticeProps = {
  productId: number;
};

/**
 * What a preview product shows where a buyable one shows its purchase panel:
 * the status and the launch form, nothing to buy.
 *
 * It fills the SAME column of the regular PDP, under the same `h1`, so the two
 * layouts cannot drift apart: only the contents of the panel slot differ.
 */
export function PreviewNotice({ productId }: PreviewNoticeProps) {
  return (
    <>
      <p className='font-display text-2xl leading-none text-foreground md:text-[34px]'>
        Próximamente
      </p>
      <div className='w-full pt-4 md:max-w-130 md:pt-6'>
        <LaunchNotifyForm productId={productId} />
      </div>
    </>
  );
}
