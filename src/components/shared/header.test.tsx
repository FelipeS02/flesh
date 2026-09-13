import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartCatalog } from '@/modules/cart/domain/catalog-projection';
import { CartProvider, useCartDispatch } from '@/modules/cart';
import { Header } from './header';

// Captures what `Header` actually hands `CartToastViewport` as `anchor`,
// without depending on Floating UI resolving a real position in jsdom (it
// never does — jsdom has no layout, so even a genuine anchor stays at
// `opacity: 0`, which makes that style useless as a test signal here). A
// `useRef` object passed by mistake would show up here as `{current: ...}`,
// never as an `Element` — that IS the regression this test guards against.
// `vi.hoisted` is required because `vi.mock` factories run before this
// file's own top-level statements, due to import hoisting.
const toastViewportProbe = vi.hoisted(() => ({
  anchor: undefined as unknown,
  renderCount: 0,
}));

vi.mock('@/modules/cart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/cart')>();
  return {
    ...actual,
    CartToastViewport: (props: { anchor: Element | null }) => {
      toastViewportProbe.anchor = props.anchor;
      toastViewportProbe.renderCount += 1;
      return null;
    },
  };
});

const PRICE = { amount: 2_700_000, currency: 'ARS' } as const;
const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: 'remera-classic',
    title: 'Remera Classic',
    image: null,
    variants: [
      {
        id: 201,
        combination: ['M'],
        price: PRICE,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
    ],
  },
];

function SeedCart({ quantity }: { quantity: number }) {
  const dispatch = useCartDispatch();

  useLayoutEffect(() => {
    if (quantity > 0) {
      dispatch({
        type: 'add',
        productId: 101,
        variantId: 201,
        price: PRICE,
        quantity,
        limit: null,
      });
    }
  }, [dispatch, quantity]);

  return null;
}

function renderHeader(quantity = 0) {
  return render(
    <CartProvider catalog={CATALOG} transferRateBp={1000}>
      <SeedCart quantity={quantity} />
      <Header />
    </CartProvider>,
  );
}

afterEach(() => {
  toastViewportProbe.anchor = undefined;
  toastViewportProbe.renderCount = 0;
});

describe('Header', () => {
  it('renders a link to the homepage wrapping the wordmark', () => {
    renderHeader();

    const link = screen.getByRole('link', { name: /flesh/i });

    expect(link.getAttribute('href')).toBe('/');
  });

  it('renders the FLESH wordmark svg inside that link', () => {
    renderHeader();

    const link = screen.getByRole('link', { name: /flesh/i });
    const svg = link.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 575 229');
  });

  it('keeps the wordmark in the middle column and reserves the third for the cart trigger', () => {
    const { container } = renderHeader();

    const header = container.querySelector('header');
    const link = screen.getByRole('link', { name: /flesh/i });

    expect(header?.children).toHaveLength(2);
    expect(header?.firstElementChild).toBe(link);
    expect(
      screen.getByRole('button', { name: 'Abrir carrito' }),
    ).not.toBeNull();
  });

  it('keeps the band pinned and shrinks the wordmark while scrolling', () => {
    const { container } = renderHeader();
    const band = container.querySelector<HTMLElement>('[data-header-band]');
    const wordmark = screen
      .getByRole('link', { name: /flesh/i })
      .querySelector('svg');

    expect(band?.classList.contains('sticky')).toBe(true);
    expect(band?.style.getPropertyValue('--header-scroll-progress')).toBe('0');
    expect(band?.style.getPropertyValue('--_logotype-scale')).toBe('1');
    expect(wordmark?.classList.contains('scale-(--_logotype-scale)')).toBe(
      true,
    );

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 80 });
    fireEvent.scroll(window);

    expect(band?.style.getPropertyValue('--header-scroll-progress')).toBe(
      '0.5',
    );
    expect(band?.style.getPropertyValue('--_logotype-scale')).toBe('0.875');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 320,
    });
    fireEvent.scroll(window);

    expect(band?.style.getPropertyValue('--header-scroll-progress')).toBe('1');
    expect(band?.style.getPropertyValue('--_logotype-scale')).toBe('0.75');
  });

  it('carries the promo marquee inside the band, so it reads the same scroll progress', () => {
    const { container } = renderHeader();

    const band = container.querySelector('[data-header-band]');
    const marquee = container.querySelector('[data-promo-marquee]');

    expect(marquee).not.toBeNull();
    expect(band?.contains(marquee!)).toBe(true);
    // Above the wordmark row: the marquee is the first thing on the page,
    // and the one that collapses out of the way first.
    expect(band?.firstElementChild).toBe(marquee);
  });

  it('shows the ready item count and opens the cart drawer from its trigger', () => {
    renderHeader(2);

    expect(screen.getByText('2')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir carrito' }));

    expect(screen.getByRole('dialog', { name: 'Carrito' })).not.toBeNull();
  });

  it('renders no count while the cart is hydrating', () => {
    const markup = renderToStaticMarkup(
      <CartProvider catalog={CATALOG} transferRateBp={1000}>
        <Header />
      </CartProvider>,
    );

    expect(markup).not.toContain('aria-label="0 productos en el carrito"');
    expect(markup).not.toContain('aria-label="2 productos en el carrito"');
  });

  it('hands the toast viewport the cart trigger itself as its anchor, not a ref object', () => {
    renderHeader();

    const trigger = screen.getByRole('button', { name: 'Abrir carrito' });

    // A `useRef` object passed by mistake would show up here as
    // `{current: HTMLButtonElement}`, never as the element itself — see
    // `isElement`'s narrowing in `ToastPositioner.js:55`, which is exactly
    // the trap a callback ref into state avoids.
    expect(toastViewportProbe.anchor).toBe(trigger);
  });

  it('stops rendering the toast viewport while the cart drawer is open', () => {
    renderHeader();
    const renderCountWhileClosed = toastViewportProbe.renderCount;
    expect(renderCountWhileClosed).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir carrito' }));

    // `Header` re-renders on `cartOpen` changing — if `CartToastViewport`
    // were still in the tree it would render again too. Suppression is a
    // conditional EXCLUSION (design D3), not a prop toggle.
    expect(toastViewportProbe.renderCount).toBe(renderCountWhileClosed);
  });
});
