import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { BuyerProfilePort, CheckoutPort } from '../api/port';
import {
  CART_STORAGE_KEY,
  createCartStorage,
  type CartStoragePort,
} from '../api/storage';
import type { CartCatalog } from '../domain/catalog-projection';
import type { StoredCart } from '../domain/reconcile';
import { markHandoff } from '../api/handoff-marker';
import {
  CartProvider,
  useCartDispatch,
  useCartEnvironment,
  useCartState,
} from './cart-context';

const CATALOG_PRICE_201 = { amount: 2_700_000, currency: 'ARS' } as const;
const CATALOG_PRICE_202 = { amount: 3_100_000, currency: 'ARS' } as const;
const TRANSFER_RATE_BP = 1000;

/**
 * Variant 203 is out of stock and 201 is priced at 2.700.000 Ã¢â‚¬â€ both matter:
 * the stored carts below deliberately disagree with this catalog so that
 * rehydration has real drift to reconcile rather than a happy path to wave
 * through.
 */
const CATALOG: CartCatalog = [
  {
    productId: 101,
    slug: 'remera-classic',
    title: 'Remera Classic',
    image: null,
    variants: [
      {
        id: 201,
        sku: null,
        combination: ['M'],
        price: CATALOG_PRICE_201,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
      {
        id: 202,
        sku: null,
        combination: ['L'],
        price: CATALOG_PRICE_202,
        compareAt: null,
        inStock: true,
        stockManagement: false,
        stock: null,
      },
      {
        id: 203,
        sku: null,
        combination: ['XL'],
        price: CATALOG_PRICE_201,
        compareAt: null,
        inStock: false,
        stockManagement: true,
        stock: 0,
      },
    ],
  },
];

/**
 * A storage port whose writes are recorded IN ORDER, because the order is the
 * behaviour under test: the first write must never be the empty initial state
 * landing on top of a stored cart.
 */
function recordingStorage(initial: StoredCart | null = null) {
  const writes: StoredCart[] = [];
  let record = initial;

  const port: CartStoragePort = {
    read: () => record,
    write: (cart) => {
      writes.push(cart);
      record = cart;
    },
    clear: () => {
      record = null;
    },
  };

  return { port, writes, record: () => record };
}

/** Renders the state as text, so every assertion below reads real output. */
function Probe() {
  const state = useCartState();

  if (state.status === 'hydrating') {
    return <p data-testid='hydrating'>cargando</p>;
  }

  return (
    <div>
      <ul data-testid='lines'>
        {state.lines.map((line) => (
          <li
            key={line.variantId}
          >{`${line.variantId} x${line.quantity} @${line.price.amount}`}</li>
        ))}
      </ul>
      <ul data-testid='notices'>
        {state.notices.map((notice) => (
          <li key={notice.variantId}>{`${notice.kind}:${notice.variantId}`}</li>
        ))}
      </ul>
    </div>
  );
}

function Controls() {
  const dispatch = useCartDispatch();

  return (
    <>
      <button
        type='button'
        onClick={() =>
          dispatch({
            type: 'add',
            productId: 101,
            variantId: 202,
            price: CATALOG_PRICE_202,
            limit: null,
          })
        }
      >
        agregar
      </button>
      <button
        type='button'
        onClick={() => dispatch({ type: 'dismissNotice', variantId: 203 })}
      >
        descartar
      </button>
    </>
  );
}

/**
 * Dispatches during the LAYOUT phase, which React runs before the provider's
 * passive mount effect Ã¢â‚¬â€ a deterministic stand-in for a click that lands
 * between mount and the read, with no timers and no luck involved.
 */
function MidFlightAdd({ statusAtClick }: { statusAtClick: string[] }) {
  const dispatch = useCartDispatch();
  const state = useCartState();

  useLayoutEffect(() => {
    // Recorded, not assumed. Both orderings would produce the same final
    // quantity if the add merely landed late, so the test needs proof that the
    // cart was still hydrating when this dispatch went out Ã¢â‚¬â€ otherwise it
    // would be green without the merge path ever running.
    statusAtClick.push(state.status);
    dispatch({
      type: 'add',
      productId: 101,
      variantId: 201,
      price: CATALOG_PRICE_201,
      limit: null,
    });
    // Fires once, at the moment before the provider's own mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function mount(
  storage: CartStoragePort,
  children: ReactNode = <Probe />,
  checkout?: CheckoutPort,
) {
  return render(
    <CartProvider
      catalog={CATALOG}
      transferRateBp={TRANSFER_RATE_BP}
      storage={storage}
      checkout={checkout}
    >
      {children}
    </CartProvider>,
  );
}

function lineTexts() {
  return Array.from(screen.getByTestId('lines').children).map(
    (node) => node.textContent,
  );
}

function noticeTexts() {
  return Array.from(screen.getByTestId('notices').children).map(
    (node) => node.textContent,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

const STORED_201: StoredCart = {
  lines: [
    {
      productId: 101,
      variantId: 201,
      quantity: 2,
      unitPriceMinor: 2_700_000,
      currency: 'ARS',
    },
  ],
  notices: [],
};

describe('hydration', () => {
  // The server cannot read `localStorage` either, so this is simultaneously
  // the first-paint assertion and the reason the server's HTML and the
  // client's first render agree.
  it('renders as hydrating before any effect runs, exactly as the server does', () => {
    const markup = renderToStaticMarkup(
      <CartProvider catalog={CATALOG} transferRateBp={TRANSFER_RATE_BP}>
        <Probe />
      </CartProvider>,
    );

    expect(markup).toContain('cargando');
    expect(markup).not.toContain('data-testid="lines"');
  });

  it('is ready with the stored lines once the mount effect has read storage', () => {
    mount(recordingStorage(STORED_201).port);

    expect(screen.queryByTestId('hydrating')).toBeNull();
    expect(lineTexts()).toEqual(['201 x2 @2700000']);
  });

  // Without this the provider would never leave `hydrating` and every surface
  // would wait forever on a cart that was never there.
  it('is ready and empty when storage holds nothing at all', () => {
    mount(recordingStorage(null).port);

    expect(screen.queryByTestId('hydrating')).toBeNull();
    expect(lineTexts()).toEqual([]);
  });

  it('drops a line whose variant is now out of stock and says so', () => {
    const stored: StoredCart = {
      lines: [
        {
          productId: 101,
          variantId: 203,
          quantity: 1,
          unitPriceMinor: 2_700_000,
          currency: 'ARS',
        },
      ],
      notices: [],
    };

    mount(recordingStorage(stored).port);

    expect(lineTexts()).toEqual([]);
    expect(noticeTexts()).toEqual(['removed:203']);
  });

  it("adopts the catalog's price when the stored one has drifted, and says so", () => {
    const stored: StoredCart = {
      lines: [
        {
          productId: 101,
          variantId: 202,
          quantity: 1,
          unitPriceMinor: 2_700_000,
          currency: 'ARS',
        },
      ],
      notices: [],
    };

    mount(recordingStorage(stored).port);

    expect(lineTexts()).toEqual(['202 x1 @3100000']);
    expect(noticeTexts()).toEqual(['repriced:202']);
  });

  // Design D4, ordering hazard 3: `rehydrate` merges, it does not replace.
  it('merges a click that landed before storage was read', () => {
    const statusAtClick: string[] = [];

    mount(
      recordingStorage(STORED_201).port,
      <>
        <MidFlightAdd statusAtClick={statusAtClick} />
        <Probe />
      </>,
    );

    // The add really did land in the gap, so what follows exercises the merge.
    expect(statusAtClick).toEqual(['hydrating']);
    // 2 stored + 1 clicked, in one line Ã¢â‚¬â€ not 2 (the click clobbered) and not
    // 1 (the stored cart lost to an add that arrived first).
    expect(lineTexts()).toEqual(['201 x3 @2700000']);
  });
});

describe('the write effect', () => {
  it('never lands the empty initial state on top of a stored cart', () => {
    const storage = recordingStorage(STORED_201);

    mount(storage.port);

    // The classic localStorage-provider bug is `writes[0]` being an empty
    // cart, written before anything was ever read. What must be there instead
    // is the reconciled cart.
    expect(storage.writes[0]).toEqual(STORED_201);
  });

  it('writes a line as a price witness, never as Money', () => {
    const storage = recordingStorage(null);
    mount(storage.port, <Controls />);

    fireEvent.click(screen.getByText('agregar'));

    expect(storage.record()).toEqual({
      lines: [
        {
          productId: 101,
          variantId: 202,
          quantity: 1,
          unitPriceMinor: 3_100_000,
          currency: 'ARS',
        },
      ],
      notices: [],
    });
  });

  it('flattens a repriced notice into minor units on the way out', () => {
    const storage = recordingStorage({
      lines: [
        {
          productId: 101,
          variantId: 202,
          quantity: 1,
          unitPriceMinor: 2_700_000,
          currency: 'ARS',
        },
      ],
      notices: [],
    });

    mount(storage.port);

    expect(storage.record()?.notices).toEqual([
      {
        kind: 'repriced',
        variantId: 202,
        item: 'Remera Classic / L',
        fromMinor: 2_700_000,
        toMinor: 3_100_000,
        currency: 'ARS',
      },
    ]);
  });

  // Design D3/D4: dismissal is a write-through. Dropping the notice from React
  // state alone would resurrect it on the next reload.
  //
  // This one runs against the REAL adapter over jsdom's `localStorage` rather
  // than the recording stub, because the behaviour spans both units: the
  // provider has to write the smaller notice list, and the adapter has to
  // delete a record with nothing left to remember. A stub reproducing the
  // second half would be asserting against a copy of the rule instead of the
  // rule.
  it('persists a dismissal, so the notice does not come back', () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        lines: [],
        notices: [
          {
            kind: 'removed',
            reason: 'out-of-stock',
            variantId: 203,
            item: 'Remera Classic / XL',
          },
        ],
      }),
    );

    mount(createCartStorage(window.localStorage), <Controls />);
    expect(createCartStorage(window.localStorage).read()?.notices).toHaveLength(
      1,
    );

    fireEvent.click(screen.getByText('descartar'));

    // A "reload" here is a brand-new adapter over the same backing store, the
    // only part of a reload this harness can honestly reproduce.
    expect(createCartStorage(window.localStorage).read()).toBeNull();
  });
});

describe("the provider's environment", () => {
  it('hands down the catalog and rate it was given', () => {
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
        >
          {children}
        </CartProvider>
      ),
    });

    expect(result.current.transferRateBp).toBe(TRANSFER_RATE_BP);
    expect(result.current.catalog).toEqual(CATALOG);
  });

  it('builds a checkout port over that same catalog when none is injected', async () => {
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
        >
          {children}
        </CartProvider>
      ),
    });

    const outcome = await result.current.checkout.startCheckout({
      buyer: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      lines: [],
    });

    expect(outcome).toEqual({
      status: 'unavailable',
      reason: 'No pudimos iniciar el checkout. Intent\u00e1 de nuevo.',
    });
  });

  it('uses an injected port instead, which is what makes pending testable', async () => {
    const injected: CheckoutPort = {
      startCheckout: async () => ({
        status: 'redirect', url: 'https://example.test/checkout', draftOrderId: 2070706008,
      }),
    };
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
          checkout={injected}
        >
          {children}
        </CartProvider>
      ),
    });

    expect(
      await result.current.checkout.startCheckout({
        buyer: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
        },
        lines: [],
      }),
    ).toEqual({
      status: 'redirect', url: 'https://example.test/checkout', draftOrderId: 2070706008,
    });
  });

  it('builds a buyer profile port over the real action when none is injected', () => {
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
        >
          {children}
        </CartProvider>
      ),
    });

    expect(result.current.buyerProfile).toBeDefined();
    expect(typeof result.current.buyerProfile.readSummary).toBe('function');
  });

  it('uses an injected buyer profile port instead, which is what makes the skip path testable', async () => {
    const injected: BuyerProfilePort = {
      readSummary: async () => ({ hasProfile: true, maskedLabel: 'F••• S•••' }),
    };
    const { result } = renderHook(() => useCartEnvironment(), {
      wrapper: ({ children }) => (
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(null).port}
          buyerProfile={injected}
        >
          {children}
        </CartProvider>
      ),
    });

    await expect(result.current.buyerProfile.readSummary()).resolves.toEqual({
      hasProfile: true,
      maskedLabel: 'F••• S•••',
    });
  });
});

/**
 * A hook reaching a missing provider must say so, rather than handing back a
 * default that silently behaves like an empty cart Ã¢â‚¬â€ which is the same lie the
 * hydration union exists to forbid, arriving through a different door.
 */
describe('used outside the provider', () => {
  it('refuses to read state', () => {
    expect(() => renderHook(() => useCartState())).toThrow(/CartProvider/);
  });

  it('refuses to hand out a dispatch', () => {
    expect(() => renderHook(() => useCartDispatch())).toThrow(/CartProvider/);
  });

  it('refuses to hand out the environment', () => {
    expect(() => renderHook(() => useCartEnvironment())).toThrow(
      /CartProvider/,
    );
  });
});

describe('the returning-shopper check', () => {
  const STORED: StoredCart = {
    lines: [
      { productId: 101, variantId: 201, quantity: 2, unitPriceMinor: 2_700_000, currency: 'ARS' },
    ],
    notices: [],
  };

  function mountWithOrderStatus(hasCompletedCheckout: () => Promise<boolean>) {
    // Without the marker the provider never asks at all — see the dedicated
    // test below. Every case here is about a visitor who WAS handed off.
    markHandoff();
    const storage = recordingStorage(STORED);
    render(
      <CartProvider
        catalog={CATALOG}
        transferRateBp={TRANSFER_RATE_BP}
        storage={storage.port}
        orderStatus={{ hasCompletedCheckout }}
      >
        <Probe />
      </CartProvider>,
    );
    return storage;
  }

  // The purchase happens on the provider's domain, so the shopper comes back to
  // a page that never saw it and a cart that still holds what they just bought.
  it('empties a cart the shopper already paid for', async () => {
    mountWithOrderStatus(async () => true);

    await waitFor(() => expect(lineTexts()).toEqual([]));
  });

  // The mirror case, and the one that must never break: abandoning a checkout
  // is the common ending, and those lines are the shopper's work.
  it('leaves the cart alone when the checkout was never completed', async () => {
    mountWithOrderStatus(async () => false);

    await waitFor(() => expect(lineTexts()).toHaveLength(1));
    expect(lineTexts()).toHaveLength(1);
  });

  it('keeps the cart when the check itself fails', async () => {
    mountWithOrderStatus(async () => {
      throw new Error('network');
    });

    await waitFor(() => expect(lineTexts()).toHaveLength(1));
    expect(lineTexts()).toHaveLength(1);
  });

  // The stored cart has to survive being restored before it can be cleared: if
  // a clear landed first, the rehydrate would simply put the lines back.
  it('clears only after the stored cart has been restored', async () => {
    const storage = mountWithOrderStatus(async () => true);

    await waitFor(() => expect(lineTexts()).toEqual([]));
    expect(storage.writes.at(-1)).toEqual({ lines: [], notices: [] });
  });
});

describe('the returning-shopper check under a remount', () => {
  const STORED: StoredCart = {
    lines: [
      { productId: 101, variantId: 201, quantity: 2, unitPriceMinor: 2_700_000, currency: 'ARS' },
    ],
    notices: [],
  };

  /**
   * The server answer is ONE-SHOT by construction: it is backed by a cookie the
   * server deletes as it answers yes, so a second ask returns false. Strict Mode
   * mounts every effect twice in development, which means a throwaway first run
   * is the one that spends the answer. This fake reproduces exactly that, and it
   * is the shape of the real bug: the cookie vanished and the cart stayed full.
   */
  function oneShotPort() {
    let spent = false;
    return {
      hasCompletedCheckout: async () => {
        if (spent) return false;
        spent = true;
        return true;
      },
    };
  }

  it('still empties the cart when the effect is mounted twice', async () => {
    markHandoff();
    render(
      <StrictMode>
        <CartProvider
          catalog={CATALOG}
          transferRateBp={TRANSFER_RATE_BP}
          storage={recordingStorage(STORED).port}
          orderStatus={oneShotPort()}
        >
          <Probe />
        </CartProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(lineTexts()).toEqual([]));
  });
});

describe('the handoff marker gate', () => {
  const STORED: StoredCart = {
    lines: [
      { productId: 101, variantId: 201, quantity: 2, unitPriceMinor: 2_700_000, currency: 'ARS' },
    ],
    notices: [],
  };

  function mount(orderStatus: { hasCompletedCheckout: () => Promise<boolean> }) {
    render(
      <CartProvider
        catalog={CATALOG}
        transferRateBp={TRANSFER_RATE_BP}
        storage={recordingStorage(STORED).port}
        orderStatus={orderStatus}
      >
        <Probe />
      </CartProvider>,
    );
  }

  // The visitor who never went to checkout is almost every visitor. They pay
  // nothing for this feature: no wait, and no request either.
  it('never asks the server when no handoff is pending', async () => {
    const hasCompletedCheckout = vi.fn(async () => true);

    mount({ hasCompletedCheckout });

    await waitFor(() => expect(lineTexts()).toHaveLength(1));
    expect(hasCompletedCheckout).not.toHaveBeenCalled();
  });

  // The flicker this whole gate exists to prevent: lines painted, then pulled
  // away once the answer lands.
  it('shows nothing rather than lines it may be about to remove', async () => {
    markHandoff();
    let answer: (completed: boolean) => void = () => {};
    mount({ hasCompletedCheckout: () => new Promise((resolve) => { answer = resolve; }) });

    expect(screen.queryByTestId('lines')).toBeNull();

    answer(true);
    await waitFor(() => expect(lineTexts()).toEqual([]));
  });

  it('gives the cart back when the shopper only abandoned the checkout', async () => {
    markHandoff();

    mount({ hasCompletedCheckout: async () => false });

    await waitFor(() => expect(lineTexts()).toHaveLength(1));
  });

  // Held forever is worse than held wrong: past the ceiling the stored cart is
  // shown, and the latch keeps a late answer from yanking it away afterwards.
  it('stops waiting and shows the cart once the ceiling passes', async () => {
    markHandoff();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mount({ hasCompletedCheckout: () => new Promise(() => {}) });
      expect(screen.queryByTestId('lines')).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(lineTexts()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('consumes the marker, so the next visit does not wait again', async () => {
    markHandoff();

    mount({ hasCompletedCheckout: async () => false });

    await waitFor(() => expect(lineTexts()).toHaveLength(1));
    expect(window.localStorage.getItem('flesh.cart.handoff.v1')).toBeNull();
  });
});
