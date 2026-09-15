'use client';

import { Button } from '@/components/ui/button';

type CheckoutHandoffLinkProps = {
  url: string;
};

/**
 * The manual way through, shown ONLY once `useCheckoutHandoff` reports that the
 * navigation it started never happened.
 *
 * It carries no click tracking of its own: the handoff was already reported
 * when the hook followed the anchor, and this is the same handoff offered a
 * second time, not another one.
 */
export function CheckoutHandoffLink({ url }: CheckoutHandoffLinkProps) {
  return (
    <Button
      asChild
      className='h-12 w-full bg-primary font-display text-lg text-primary-foreground hover:bg-primary md:h-14 md:text-xl'
    >
      <a href={url}>Continuar al checkout</a>
    </Button>
  );
}
