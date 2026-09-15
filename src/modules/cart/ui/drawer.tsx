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
import {
  createEcommerceEvent,
  sendAnalyticsEvent,
  toAnalyticsItem,
} from '@/modules/analytics';
import { EmptyState } from './empty-state';
import { LineRow } from './line-row';
import { CartNotices } from './notices';
import { CartSummary } from './summary';
import { BuyerDialog } from './buyer-dialog';
import { describeCheckoutOutcome } from './checkout-outcome';
import { useCartEnvironment, useCartState } from '../state/cart-context';
import { useCheckout, type CheckoutUiState } from '../state/use-checkout';
import { useCheckoutHandoff } from '../state/use-checkout-handoff';
import { indexCartCatalog, type CartCatalog } from '../domain/catalog-projection';
import type { CheckoutBuyer } from '../domain/line';
import BarbedWireSeparator from '@/components/shared/barbed-wire-separator';
import { CheckoutHandoffLink } from './checkout-handoff-link';

type CartDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void };
const IDLE: CheckoutUiState = { phase: 'idle' };

/**
 * `loading` is the only phase a late `readSummary` resolution is ever
 * allowed to leave (design D2 skip path) — once the read has settled to
 * `absent` or `saved`, a resolution arriving afterwards must not overwrite
 * what the shopper is doing. The former `editing` phase is gone: entering
 * buyer details now always happens in the modal (`BuyerDialog`), which owns
 * its own local form state instead of a fourth drawer phase.
 */
type ProfilePhase = 'loading' | 'absent' | 'saved';

/**
 * Tracks which surface the in-flight/settled checkout attempt belongs to, so
 * a failure renders in the one place it started from: the drawer's own
 * one-click `saved` submit keeps its inline alert exactly as it shipped
 * before this change, and a modal-started attempt (first-time buyer, or
 * `CAMBIAR`) keeps its notice inside the modal instead.
 */
type CheckoutOrigin = 'drawer' | 'modal' | null;

/** Keeps buyer details in local component state so checkout data is never persisted with cart state. */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const state = useCartState();
  const { catalog, checkout, buyerProfile } = useCartEnvironment();
  const checkoutMachine = useCheckout(checkout);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState<ProfilePhase>('loading');
  const [maskedLabel, setMaskedLabel] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const [modalOpen, setModalOpen] = useState(false);
  const [origin, setOrigin] = useState<CheckoutOrigin>(null);
  const trackedOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      trackedOpen.current = false;
      return;
    }
    if (trackedOpen.current || state.status !== 'ready' || state.lines.length === 0) {
      return;
    }

    const index = indexCartCatalog(catalog);
    const items = state.lines.flatMap((line) => {
      const entry = index.get(line.variantId);
      return entry
        ? [
            toAnalyticsItem({
              variantId: entry.variant.id,
              itemName: entry.product.title,
              combination: entry.variant.combination,
              price: entry.variant.price,
              quantity: line.quantity,
            }),
          ]
        : [];
    });

    trackedOpen.current = true;
    if (items.length > 0) {
      sendAnalyticsEvent(createEcommerceEvent('view_cart', items));
    }
  }, [catalog, open, state]);

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
  // flips, never merely because `profile` changed while it stayed open.
  useEffect(() => {
    if (!open) return;
    buyerProfile
      .readSummary()
      .then((summary) => {
        // Only `loading` may be overwritten — a shopper who already reached
        // `saved`/`absent` keeps what they have, per the "late resolution
        // never discards typed input" scenario.
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

  function handleDrawerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only ever wired up as a real `type="submit"` control in the `saved`
    // phase (see the button below) — no buyer is sent, so `resolveBuyer`
    // falls through to the httpOnly cookie server-side (already unit-tested
    // there; this path deliberately does not duplicate that logic).
    const lines = state.status === 'ready' ? state.lines : [];
    setOrigin('drawer');
    checkoutMachine.start({ lines });
  }

  function handleModalSubmit(buyer: CheckoutBuyer) {
    const lines = state.status === 'ready' ? state.lines : [];
    setOrigin('modal');
    checkoutMachine.start({ buyer, lines });
  }

  // Each surface only ever sees the outcome of an attempt it started —
  // otherwise a modal failure would also flash the drawer's own alert (or
  // vice versa), even though only one of the two was ever open when the
  // shopper submitted.
  const drawerCheckoutState: CheckoutUiState = origin === 'drawer' ? checkoutMachine.state : IDLE;
  const modalCheckoutState: CheckoutUiState = origin === 'modal' ? checkoutMachine.state : IDLE;
  // The handoff follows its own anchor, so this surface is left exactly as it
  // was until the hook reports that the navigation never happened.
  const handoffUrl = redirectUrl(drawerCheckoutState);
  const { stalled } = useCheckoutHandoff(handoffUrl);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        initialFocus={closeButtonRef}
        className='max-md:w-svw! max-w-md gap-0 bg-background p-6 shadow-2xl'
        styledBackground
      >
        <SheetHeader className='flex-row items-center justify-between p-0'>
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
        <BarbedWireSeparator />
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
                  {/* `saved` is the only phase this form actually submits:
                      `absent` (and `loading`) render Pagar as `type="button"`
                      so it opens the modal instead of firing this handler. */}
                  <form onSubmit={handleDrawerSubmit}>
                    {profile === 'loading' && (
                      // Fixed height so the layout does not jump once the
                      // real content (row or plain button) replaces it.
                      <div
                        className='h-24'
                        aria-hidden='true'
                        data-testid='buyer-profile-loading'
                      />
                    )}
                    {profile === 'saved' && (
                      <div className='flex items-center justify-between gap-2 pb-2'>
                        <div>
                          <p className='font-sans text-xs uppercase tracking-wide text-muted-foreground'>
                            COMPRAR COMO
                          </p>
                          {/* The visible text itself IS the accessible name
                              (spec "Accessible name matches visible text") —
                              no `aria-label` here that could carry the real
                              name. */}
                          <p className='font-sans text-sm text-foreground'>{maskedLabel}</p>
                        </div>
                        <Button
                          type='button'
                          variant='link'
                          className='-mr-3 text-muted-foreground'
                          onClick={() => setModalOpen(true)}
                        >
                          CAMBIAR
                        </Button>
                      </div>
                    )}
                    <Button
                      hidden={stalled}
                      type={profile === 'saved' ? 'submit' : 'button'}
                      onClick={profile === 'absent' ? () => setModalOpen(true) : undefined}
                      // Spent for good once a handoff succeeds: the browser is
                      // already leaving, and an impatient second press would open
                      // a second Draft Order for a cart on its way out. A failed
                      // attempt navigates nowhere, so that one is handed back.
                      disabled={
                        checkoutMachine.state.phase === 'pending' ||
                        profile === 'loading' ||
                        handoffUrl !== null
                      }
                      className='h-12 w-full bg-primary font-display text-lg text-primary-foreground hover:bg-primary disabled:bg-muted disabled:text-muted-foreground md:h-14 md:text-xl'
                    >
                      {drawerCheckoutState.phase === 'pending'
                        ? 'Finalizando compra...'
                        : 'Finalizar compra'}
                    </Button>
                    {/* The drawer's own one-click (`saved`) failure path,
                        unchanged from before the modal existed. A
                        modal-started failure never reaches here — see
                        `modalCheckoutState` and `BuyerDialog` instead. */}
                    <CheckoutOutcome
                      catalog={catalog}
                      state={drawerCheckoutState}
                      stalled={stalled}
                    />
                  </form>
                </div>
              )}
            </div>
          </>
        )}
        {/* Rendered inside the sheet's own content on purpose (the "main
            risk" this change carries): a second Base UI dialog stacked
            inside the cart's, so Escape must close only this one and focus
            must return to whichever control opened it, never to the
            drawer's close button. */}
        <BuyerDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSubmit={handleModalSubmit}
          checkoutState={modalCheckoutState}
          catalog={catalog}
        />
      </SheetContent>
    </Sheet>
  );
}

/** The destination a settled checkout hands off to, or null for every other state. */
export function redirectUrl(state: CheckoutUiState): string | null {
  return state.phase === 'settled' && state.outcome.status === 'redirect'
    ? state.outcome.url
    : null;
}

type CheckoutOutcomeProps = {
  catalog: CartCatalog;
  state: CheckoutUiState;
  stalled: boolean;
};
function CheckoutOutcome({ catalog, state, stalled }: CheckoutOutcomeProps) {
  const url = redirectUrl(state);
  if (url) {
    return stalled ? <CheckoutHandoffLink url={url} /> : null;
  }
  const message = describeCheckoutOutcome(state, catalog);
  if (!message) return null;
  return (
    <p role='alert' className='pt-3 font-sans text-sm text-muted-foreground'>
      {message}
    </p>
  );
}
