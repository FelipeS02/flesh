import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckoutHandoffLink } from './checkout-handoff-link';

const URL = 'https://checkout.example.com/checkout/9/token';

describe('CheckoutHandoffLink', () => {
  it('offers the destination as a link the shopper can follow by hand', () => {
    render(<CheckoutHandoffLink url={URL} />);

    expect(
      screen.getByRole('link', { name: 'Continuar al checkout' }).getAttribute('href'),
    ).toBe(URL);
  });
});
