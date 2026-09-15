'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CheckoutBuyer } from '../domain/line';
import type { CartCatalog } from '../domain/catalog-projection';
import type { CheckoutUiState } from '../state/use-checkout';
import { describeCheckoutOutcome, isCheckoutFailure } from './checkout-outcome';
import { CheckoutHandoffLink } from './checkout-handoff-link';
import { useCheckoutHandoff } from '../state/use-checkout-handoff';

const EMPTY_BUYER: CheckoutBuyer = { firstName: '', lastName: '', email: '' };

/**
 * The three fields differ only in these four values, so they are data rather
 * than three near-identical copies of the same markup — the copies are how the
 * `autoComplete` token on one of them eventually ends up wrong or missing, and
 * those tokens are what make the browser fill this form in on the next visit.
 *
 * Labels stay in natural case here and are upper-cased in CSS: the artboards
 * draw them uppercase, but the accessible name a screen reader announces (and
 * the tests query) should read `Nombre`, not `NOMBRE`.
 */
const BUYER_FIELDS: {
  name: keyof CheckoutBuyer;
  label: string;
  type?: string;
  autoComplete: string;
}[] = [
  { name: 'firstName', label: 'Nombre', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Apellido', autoComplete: 'family-name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
];

type BuyerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (buyer: CheckoutBuyer) => void;
  checkoutState: CheckoutUiState;
  catalog: CartCatalog;
};

/**
 * Holds the real `<form>` the maintainer's pen.dev screens moved out of the
 * drawer — a genuine `type="submit"` control is the only reason the browser
 * offers to save the profile and autofills it next time (the entire point
 * of the shipped skip path), so this must never become a synthetic submit
 * dispatched from a button click handler.
 */
export function BuyerDialog({ open, onOpenChange, onSubmit, checkoutState, catalog }: BuyerDialogProps) {
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [wasOpen, setWasOpen] = useState(open);

  // Adjusting state during render (react.dev/learn/you-might-not-need-an-effect)
  // rather than in an effect, matching the drawer's own D2 precedent. Every
  // open comes up blank on purpose: the real buyer values live in an
  // httpOnly cookie that never reaches the client (see `readSummary` at
  // drawer.tsx), so even reopening for a shopper the drawer already
  // recognizes as `saved` has nothing to prefill from. Do not "fix" this by
  // wiring the masked summary in here — there is no unmasked value behind it.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBuyer(EMPTY_BUYER);
  }

  const updateBuyer = (field: keyof CheckoutBuyer, value: string) =>
    setBuyer((current) => ({ ...current, [field]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(buyer);
  }

  const failed = isCheckoutFailure(checkoutState);
  const message = describeCheckoutOutcome(checkoutState, catalog);
  const pending = checkoutState.phase === 'pending';
  const redirect =
    checkoutState.phase === 'settled' && checkoutState.outcome.status === 'redirect'
      ? checkoutState.outcome
      : null;
  // The handoff follows its own anchor. Swapping the form out for a link the
  // moment the Draft Order lands would leave the shopper staring at a button
  // they are about to be carried past, so the form stays until the hook says
  // the navigation never happened.
  const { stalled } = useCheckoutHandoff(redirect?.url ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The shared `dialog.tsx` default close button is suppressed because it
          ships an untranslated "Close" label, and shopper copy here is Spanish
          (AGENTS.md). It is replaced rather than dropped: Escape is no exit on
          touch, and tapping outside a modal stacked over the drawer reads as
          ambiguous. Same composition the drawer uses for `SheetClose`. */}
      <DialogContent styledBackground className='max-w-sm' showCloseButton={false}>
        <DialogHeader className='flex-row items-start justify-between'>
          <div className='grid gap-1.5'>
            {/* The primitive's default title is `text-base`, sized for a
                confirm prompt. This one is a surface the shopper lands on
                mid-checkout, so it carries the drawer's own title weight. */}
            <DialogTitle className='font-display text-2xl text-foreground'>
              Completá tus datos
            </DialogTitle>
            <DialogDescription className='font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground'>
              Para iniciar tu compra
            </DialogDescription>
          </div>
          <DialogClose
            aria-label='Cerrar'
            render={<button type='button' className='text-foreground' />}
          >
            <X aria-hidden='true' className='size-5' />
          </DialogClose>
        </DialogHeader>
        {redirect && stalled ? (
          <CheckoutHandoffLink url={redirect.url} />
        ) : (
        <form onSubmit={handleSubmit} className='grid gap-2'>
          {/* Spent while the handoff is in flight as well as during the
              request: a successful redirect is already navigating away, and a
              second submit would open a second Draft Order. A failure settles
              with no destination, so the form comes back for a retry. */}
          <fieldset className='grid gap-5' disabled={pending || redirect !== null}>
            {BUYER_FIELDS.map((field) => (
              <div key={field.name} className='grid gap-2.5'>
                <Label
                  htmlFor={`checkout-${field.name}`}
                  className='font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground'
                >
                  {field.label}
                </Label>
                <Input
                  id={`checkout-${field.name}`}
                  name={field.name}
                  type={field.type}
                  required
                  value={buyer[field.name]}
                  onChange={(event) => updateBuyer(field.name, event.target.value)}
                  autoComplete={field.autoComplete}
                  className='h-13 border-input bg-foreground/5 px-4 font-sans text-base text-foreground'
                />
              </div>
            ))}
          </fieldset>
          <Button
            type='submit'
            disabled={pending || redirect !== null}
            className='mt-2 h-12 w-full bg-primary font-display text-lg text-primary-foreground hover:bg-primary disabled:bg-muted disabled:text-muted-foreground'
          >
            {failed ? 'Reintentar' : 'Continuar al pago'}
          </Button>
          {/* Only a failure started from this modal ever reaches here — a
              one-click drawer failure renders its own alert in drawer.tsx
              and never touches `checkoutState` passed into this component. */}
          {failed && message && (
            <p role='alert' className='pt-1 font-sans text-sm text-muted-foreground'>
              {message}
            </p>
          )}
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
