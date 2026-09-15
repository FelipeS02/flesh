import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartStoragePort } from '../api/storage';
import type { CartCatalog } from '../domain/catalog-projection';
import { CartProvider, useCartDispatch } from '../state/cart-context';
import { CartSummary } from './summary';

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
        sku: null,
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

function emptyStorage(): CartStoragePort {
  return { read: () => null, write: () => {}, clear: () => {} };
}

function Harness() {
  const dispatch = useCartDispatch();

  return (
    <>
      <button
        type='button'
        onClick={() =>
          dispatch({
            type: 'add',
            productId: 101,
            variantId: 201,
            price: PRICE,
            quantity: 3,
            limit: null,
          })
        }
      >
        seed
      </button>
      <CartSummary />
    </>
  );
}

describe('CartSummary', () => {
  it('labels the transfer total as Subtotal, keeps Total the same figure, and drops the discount amount', () => {
    render(
      <CartProvider
        catalog={CATALOG}
        transferRateBp={1000}
        storage={emptyStorage()}
      >
        <Harness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'seed' }));

    // Both labels now render the SAME transfer figure (design D1: the
    // domain is untouched, only the label and the discount row's copy
    // change) — $81.000 x3 at 10% transfer is $72.900.
    expect(screen.getByText('Subtotal')).not.toBeNull();
    expect(screen.getByText('Total')).not.toBeNull();
    expect(screen.getAllByText('$72.900')).toHaveLength(2);

    // The raw, non-transfer subtotal must never appear — Subtotal now means
    // the transfer total, not the list-price sum.
    expect(screen.queryByText('$81.000')).toBeNull();

    // The discount row becomes amount-less informative text.
    expect(
      screen.getByText('incluye 10% off por transferencia'),
    ).not.toBeNull();
    expect(screen.queryByText('-$8.100')).toBeNull();
    expect(screen.queryByText('Descuento por transferencia')).toBeNull();
  });
});
