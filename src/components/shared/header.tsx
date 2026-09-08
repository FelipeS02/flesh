'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import FleshLogotype from '@/components/shared/flesh-logotype';
import { CartDrawer, itemCount, useCartState } from '@/modules/cart';

const HEADER_SCROLL_RANGE = 160;
const LOGOTYPE_TARGET_SCALE = 0.75;

/** The header owns the controlled cart drawer and its hydration-safe badge. */
export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const state = useCartState();
  const count = state.status === 'ready' ? itemCount(state.lines) : null;

  useEffect(() => {
    const syncScrollProgress = () => {
      const progress = Math.min(
        Math.max(window.scrollY / HEADER_SCROLL_RANGE, 0),
        1,
      );
      headerRef.current?.style.setProperty(
        '--_header-scroll-progress',
        String(progress),
      );
      headerRef.current?.style.setProperty(
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
      <header
        ref={headerRef}
        className='isolate before:bg-linear-to-b before:backdrop-blur-md before:bg-background before:mask-b-from-0 before:-z-1 before:absolute before:inset-0 before:-mx-4 before:opacity-(--_header-scroll-progress) sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center py-3.5 md:py-5.5'
        style={
          {
            '--_header-scroll-progress': 0,
            '--_logotype-scale': 1,
          } as CSSProperties
        }
      >
        <Link
          href='/'
          aria-label='FLESH inicio'
          className='col-start-2 justify-self-center'
        >
          <FleshLogotype className='w-28 md:w-40 origin-top scale-(--_logotype-scale)' />
        </Link>
        <button
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
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
