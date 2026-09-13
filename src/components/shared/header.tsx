'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import FleshLogotype from '@/components/shared/flesh-logotype';
import { PromoMarquee } from '@/components/shared/promo-marquee';
import { CartDrawer, CartToastViewport, itemCount, useCartState } from '@/modules/cart';

const HEADER_SCROLL_RANGE = 160;
const LOGOTYPE_TARGET_SCALE = 0.75;

/**
 * The header owns the controlled cart drawer and its hydration-safe badge.
 *
 * It also owns the page's ONE reading of scroll position. The sticky band
 * below is what carries `--header-scroll-progress`, and everything that
 * reacts to scrolling — the backdrop fading in, the wordmark shrinking, the
 * promo band collapsing — is a CSS consumer of that one variable rather than
 * a second listener. The band is the element holding it precisely so the
 * marquee can read it by cascade instead of reaching for the document root.
 */
export function Header() {
  const bandRef = useRef<HTMLDivElement>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // A callback ref into STATE, never a `useRef` object: `ToastPositioner`
  // narrows its `anchor` prop with `isElement(anchorProp) ? anchorProp : null`
  // (`@base-ui/react/toast/positioner/ToastPositioner.js:55`) BEFORE it ever
  // reaches the generic ref-unwrapping path, so handing it a ref object
  // silently becomes `null` — see design D5.
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const state = useCartState();
  const count = state.status === 'ready' ? itemCount(state.lines) : null;

  useEffect(() => {
    const syncScrollProgress = () => {
      const progress = Math.min(
        Math.max(window.scrollY / HEADER_SCROLL_RANGE, 0),
        1,
      );
      bandRef.current?.style.setProperty(
        '--header-scroll-progress',
        String(progress),
      );
      bandRef.current?.style.setProperty(
        '--_logotype-scale',
        String(1 - progress * (1 - LOGOTYPE_TARGET_SCALE)),
      );
    };

    syncScrollProgress();
    window.addEventListener('scroll', syncScrollProgress, { passive: true });

    return () => window.removeEventListener('scroll', syncScrollProgress);
  }, []);

  return (
    <>
      {/* The BAND is what sticks, not the wordmark row: the promo marquee is
          part of what stays pinned, and the backdrop has to cover both of
          them or the marquee would read against raw page content while the
          row below it is frosted. The row keeps its own grid and nothing
          else. */}
      <div
        ref={bandRef}
        data-header-band
        className='isolate before:bg-linear-to-b before:backdrop-blur-md before:bg-background before:mask-b-from-0 before:-z-1 before:absolute before:inset-0 before:-mx-4 before:opacity-(--header-scroll-progress) sticky top-0 z-50'
        style={
          {
            '--header-scroll-progress': 0,
            '--_logotype-scale': 1,
          } as CSSProperties
        }
      >
        <PromoMarquee />

        <header className='grid grid-cols-[1fr_auto_1fr] items-center py-3.5 md:py-5.5'>
          <Link
            href='/'
            aria-label='FLESH inicio'
            className='col-start-2 justify-self-center'
          >
            <FleshLogotype className='w-28 md:w-40 origin-top scale-(--_logotype-scale)' />
          </Link>
          <button
            ref={setTriggerEl}
            type='button'
            aria-label='Abrir carrito'
            onClick={() => setCartOpen(true)}
            className='relative col-start-3 mr-4 justify-self-end text-foreground'
          >
            <ShoppingBag aria-hidden='true' className='size-5' />
            {count !== null && (
              <span
                aria-label={`${count} productos en el carrito`}
                className='absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-primary font-sans text-[9px] text-primary-foreground'
              >
                {count}
              </span>
            )}
          </button>
        </header>
      </div>
      {/* Rendered ONLY while the drawer is closed — this is the whole
          suppression mechanism (design D3). `createToastManager()` holds no
          toast state of its own, so `showAddedToCart` fired while this is
          unmounted simply emits into an empty listener set; no store entry,
          no timer, nothing to clean up. */}
      {!cartOpen && <CartToastViewport anchor={triggerEl} />}
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
