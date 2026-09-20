import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { useCheckoutHandoff, HANDOFF_STALL_MS } from '../use-checkout-handoff';

const URL = 'https://checkout.example.com/checkout/9/token';

function Probe({ url, send }: { url: string | null; send: (event: never) => unknown }) {
  const { stalled } = useCheckoutHandoff(url, send as never);
  return <p>{stalled ? 'stalled' : 'following'}</p>;
}

describe('useCheckoutHandoff', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows a real anchor so Google can decorate it, and reports the handoff once', () => {
    const send = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    render(<Probe url={URL} send={send} />);

    expect(click).toHaveBeenCalledTimes(1);
    // A detached node's click never reaches the document-level listener the
    // linker installs, so the anchor has to be in the page to be decorated.
    const clicked = click.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(clicked?.isConnected).toBe(true);
    expect(clicked?.getAttribute('href')).toBe(URL);
    expect(send).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('stays out of the way while the navigation it started is still plausible', () => {
    render(<Probe url={URL} send={vi.fn()} />);

    act(() => void vi.advanceTimersByTime(HANDOFF_STALL_MS - 1));

    expect(screen.getByText('following')).not.toBeNull();
  });

  // Past this window the browser is not being slow, it refused to go. Surfacing
  // the link is the only thing standing between the shopper and a dead end at
  // the last step of the purchase.
  it('surfaces itself once the navigation has clearly not happened', () => {
    render(<Probe url={URL} send={vi.fn()} />);

    act(() => void vi.advanceTimersByTime(HANDOFF_STALL_MS));

    expect(screen.getByText('stalled')).not.toBeNull();
  });

  it('does nothing at all until there is a destination', () => {
    const send = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    render(<Probe url={null} send={send} />);
    act(() => void vi.advanceTimersByTime(HANDOFF_STALL_MS * 2));

    expect(click).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText('following')).not.toBeNull();
    click.mockRestore();
  });
});
