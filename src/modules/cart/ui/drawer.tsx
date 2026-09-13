'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmptyState } from './empty-state';
import { LineRow } from './line-row';
import { CartNotices } from './notices';
import { CartSummary } from './summary';
import { useCartEnvironment, useCartState } from '../state/cart-context';
import { useCheckout } from '../state/use-checkout';
import {
  indexCartCatalog,
  type CartCatalog,
} from '../domain/catalog-projection';
import type { CartLineId } from '../api/port';
import CartBackground from '../assets/cart-background.png';
import Image from 'next/image';

type CartDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void };
type Buyer = { firstName: string; lastName: string; email: string };
const EMPTY_BUYER: Buyer = { firstName: '', lastName: '', email: '' };

/** Keeps buyer details in local component state so checkout data is never persisted with cart state. */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const state = useCartState();
  const { catalog, checkout } = useCartEnvironment();
  const checkoutMachine = useCheckout(checkout);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const updateBuyer = (field: keyof Buyer, value: string) =>
    setBuyer((current) => ({ ...current, [field]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        initialFocus={closeButtonRef}
        className='max-md:w-svw! max-w-md gap-0 bg-background p-6 shadow-2xl'
      >
        <Image className='-z-1 opacity-35' fill src={CartBackground} alt='background' aria-hidden />
        <SheetHeader className='flex-row items-center justify-between border-b border-border p-0 pb-4'>
          <div>
            <SheetTitle className='font-display text-2xl text-foreground'>
              Carrito
            </SheetTitle>
            <SheetDescription className='sr-only'>
              Productos agregados al carrito.
            </SheetDescription>
          </div>
          <SheetClose
            ref={closeButtonRef}
            aria-label='Cerrar carrito'
            render={<button type='button' className='text-foreground' />}
          >
            <X aria-hidden='true' className='size-5' />
          </SheetClose>
        </SheetHeader>
        {state.status === 'hydrating' ? (
          <p className='flex flex-1 items-center justify-center font-sans text-sm text-muted-foreground'>
            Cargando carrito…
          </p>
        ) : (
          <>
            {/* The one scroller in the drawer. Lines and notices are rows of
                the same column on purpose: a notice explains what happened to
                a line, and a box of its own forces a height nobody can guess
                right for both one notice and five. */}
            <div className='min-h-0 flex-1 overflow-y-auto'>
              {state.lines.map((line) => (
                <LineRow key={line.variantId} line={line} />
              ))}
              <CartNotices />
              <EmptyState state={state} onBrowse={() => onOpenChange(false)} />
            </div>

            <div className='shrink-0 pt-4'>
              <CartSummary />
              {state.lines.length > 0 && (
                <div className='pt-4'>
                  <fieldset
                    className='grid gap-2'
                    disabled={checkoutMachine.state.phase === 'pending'}
                  >
                    <label className='text-sm' htmlFor='checkout-first-name'>
                      Nombre
                    </label>
                    <input
                      id='checkout-first-name'
                      value={buyer.firstName}
                      onChange={(event) =>
                        updateBuyer('firstName', event.target.value)
                      }
                      autoComplete='given-name'
                    />
                    <label className='text-sm' htmlFor='checkout-last-name'>
                      Apellido
                    </label>
                    <input
                      id='checkout-last-name'
                      value={buyer.lastName}
                      onChange={(event) =>
                        updateBuyer('lastName', event.target.value)
                      }
                      autoComplete='family-name'
                    />
                    <label className='text-sm' htmlFor='checkout-email'>
                      Email
                    </label>
                    <input
                      id='checkout-email'
                      type='email'
                      value={buyer.email}
                      onChange={(event) =>
                        updateBuyer('email', event.target.value)
                      }
                      autoComplete='email'
                    />
                  </fieldset>
                  <button
                    type='button'
                    disabled={checkoutMachine.state.phase === 'pending'}
                    onClick={() =>
                      checkoutMachine.start({ buyer, lines: state.lines })
                    }
                    className='mt-4 h-12 w-full bg-primary font-display text-lg text-primary-foreground disabled:bg-muted disabled:text-muted-foreground md:h-14 md:text-xl'
                  >
                    {checkoutMachine.state.phase === 'pending'
                      ? 'Finalizando compra...'
                      : 'Finalizar compra'}
                  </button>
                  <CheckoutOutcome
                    catalog={catalog}
                    state={checkoutMachine.state}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type CheckoutOutcomeProps = {
  catalog: CartCatalog;
  state: ReturnType<typeof useCheckout>['state'];
};
function CheckoutOutcome({ catalog, state }: CheckoutOutcomeProps) {
  if (state.phase !== 'settled') return null;
  const message =
    state.outcome.status === 'unavailable'
      ? state.outcome.reason
      : state.outcome.status === 'rejected'
        ? `Algunos productos ya no estan disponibles: ${describeRejectedLines(state.outcome.lines, catalog)}.`
        : 'Redirigiendo al checkout…';
  return (
    <p role='alert' className='pt-3 font-sans text-sm text-muted-foreground'>
      {message}
    </p>
  );
}
function describeRejectedLines(
  lines: CartLineId[],
  catalog: CartCatalog,
): string {
  const index = indexCartCatalog(catalog);
  return lines
    .map((variantId) => {
      const entry = index.get(variantId);
      return entry
        ? `${entry.product.title} / ${entry.variant.combination.join(', ')}`
        : `Variante #${variantId}`;
    })
    .join(', ');
}
