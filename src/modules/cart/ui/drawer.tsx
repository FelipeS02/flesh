'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import type { CheckoutBuyer } from '../domain/line';
import CartBackground from '../assets/cart-background.png';
import Image from 'next/image';

type CartDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void };
const EMPTY_BUYER: CheckoutBuyer = { firstName: '', lastName: '', email: '' };

/**
 * Mirrors design D2's four-phase skip path. `loading` is the only phase a
 * late `readSummary` resolution is ever allowed to leave — once the shopper
 * has moved to `editing` (or the read already settled to `absent`), a
 * resolution arriving afterwards must not swap the form out from under them.
 */
type ProfilePhase = 'loading' | 'absent' | 'saved' | 'editing';

/** Keeps buyer details in local component state so checkout data is never persisted with cart state. */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const state = useCartState();
  const { catalog, checkout, buyerProfile } = useCartEnvironment();
  const checkoutMachine = useCheckout(checkout);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [profile, setProfile] = useState<ProfilePhase>('loading');
  const [maskedLabel, setMaskedLabel] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const updateBuyer = (field: keyof CheckoutBuyer, value: string) =>
    setBuyer((current) => ({ ...current, [field]: value }));

  // "Adjusting state when a prop changes", called during render rather than
  // from an effect (react.dev/learn/you-might-not-need-an-effect) — closing
  // forgets the outcome of the last read entirely (design D2): the next open
  // is a brand-new visit as far as the skip path is concerned, never a stale
  // answer from before the drawer closed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setProfile('loading');
  }

  // The dependency array alone gives the "runs at most once per open"
  // guarantee (design D2): this effect only re-executes when `open` itself
  // flips, never merely because `profile`/`buyer` changed while it stayed
  // open.
  useEffect(() => {
    if (!open) return;
    buyerProfile
      .readSummary()
      .then((summary) => {
        // Only `loading` may be overwritten — a shopper who already reached
        // `editing` (or an already-settled `absent`) keeps what they have,
        // per the "late resolution never discards typed input" scenario.
        setProfile((current) => {
          if (current !== 'loading') return current;
          if (summary.hasProfile) {
            setMaskedLabel(summary.maskedLabel);
            return 'saved';
          }
          return 'absent';
        });
      })
      .catch(() => {
        // Failing open to the form is the only safe direction: failing to
        // the masked label would submit under an identity the server may
        // not actually hold.
        setProfile((current) => (current === 'loading' ? 'absent' : current));
      });
  }, [open, buyerProfile]);

  function handleCambiar() {
    setBuyer(EMPTY_BUYER);
    setProfile('editing');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only ever wired up inside the `status === 'ready'` branch below, but
    // the guard lives in JSX, not in this closure's type narrowing.
    const lines = state.status === 'ready' ? state.lines : [];
    checkoutMachine.start(profile === 'saved' ? { lines } : { buyer, lines });
  }

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
                  {/* One <form> for all four phases (design D6) — Pagar stays
                      `type='submit'` even in `saved`, where the form holds no
                      inputs, so Enter and click reach the identical handler. */}
                  <form onSubmit={handleSubmit}>
                    {profile === 'loading' && (
                      // Fixed height so the layout does not jump once the
                      // real content (form or label) replaces it — matches
                      // neither shrinking to nothing nor guessing a form's
                      // eventual height.
                      <div
                        className='h-33'
                        aria-hidden='true'
                        data-testid='buyer-profile-loading'
                      />
                    )}
                    {(profile === 'absent' || profile === 'editing') && (
                      <fieldset
                        className='grid gap-2'
                        disabled={checkoutMachine.state.phase === 'pending'}
                      >
                        <label className='text-sm' htmlFor='checkout-first-name'>
                          Nombre
                        </label>
                        <input
                          id='checkout-first-name'
                          name='firstName'
                          required
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
                          name='lastName'
                          required
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
                          name='email'
                          type='email'
                          required
                          value={buyer.email}
                          onChange={(event) =>
                            updateBuyer('email', event.target.value)
                          }
                          autoComplete='email'
                        />
                      </fieldset>
                    )}
                    {profile === 'saved' && (
                      <div className='flex items-center justify-between gap-2'>
                        {/* The visible text itself IS the accessible name
                            (spec "Accessible name matches visible text") — no
                            `aria-label` here that could carry the real name. */}
                        <p className='font-sans text-sm text-foreground'>{maskedLabel}</p>
                        <Button type='button' variant='link' onClick={handleCambiar}>
                          Cambiar
                        </Button>
                      </div>
                    )}
                    <Button
                      type='submit'
                      disabled={checkoutMachine.state.phase === 'pending' || profile === 'loading'}
                      className='mt-4 h-12 w-full bg-primary font-display text-lg text-primary-foreground hover:bg-primary disabled:bg-muted disabled:text-muted-foreground md:h-14 md:text-xl'
                    >
                      {checkoutMachine.state.phase === 'pending'
                        ? 'Finalizando compra...'
                        : 'Finalizar compra'}
                    </Button>
                    <CheckoutOutcome
                      catalog={catalog}
                      state={checkoutMachine.state}
                    />
                  </form>
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
