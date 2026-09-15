'use client';

import { useEffect, useState } from 'react';
import { sendAnalyticsEvent } from '@/modules/analytics';
import { markHandoff } from '../api/handoff-marker';
import type { AnalyticsEvent } from '@/modules/analytics';

type Send = (event: AnalyticsEvent) => unknown;

/**
 * How long the handoff waits before admitting the navigation is not coming.
 *
 * Deliberately generous. The only thing this guards against is a browser that
 * refused to follow the anchor, and the cost of being wrong is asymmetric: a
 * fallback shown too early races a redirect that was merely slow on a bad
 * connection, while one shown too late only costs a few seconds of waiting.
 */
export const HANDOFF_STALL_MS = 5_000;

/**
 * Sends the shopper to the hosted checkout on the single click they already
 * made, and reports whether that failed.
 *
 * The transition has to happen through a real `<a>` that is in the document:
 * Google's cross-domain linker decorates the URL with `_gl` from a listener on
 * `document`, so a bare `location.href` assignment is never decorated and a
 * detached anchor's click never reaches the listener. That `_gl` is what keeps
 * the client id, the session and the original traffic source attached to the
 * order once Tiendanube takes over — without it every sale reads as new direct
 * traffic.
 *
 * The anchor is built here instead of rendered because the shopper must never
 * see it. They pressed "Finalizar compra"; a second button asking them to press
 * again is the step this removes. `stalled` exists for the one case where that
 * plan fails, so the surfaces can offer the link by hand rather than strand
 * someone at the last step of a purchase.
 */
export function useCheckoutHandoff(
  url: string | null,
  send: Send = sendAnalyticsEvent,
): { stalled: boolean } {
  const [stalled, setStalled] = useState(false);
  const [followed, setFollowed] = useState(url);

  // Adjusted during render rather than in the effect below, matching
  // buyer-dialog's own precedent: resetting it from inside the effect is the
  // cascading-render pattern React warns about, and a new destination has to
  // start from "not stalled" before the timer for it is even armed.
  if (url !== followed) {
    setFollowed(url);
    setStalled(false);
  }

  useEffect(() => {
    if (!url) return;

    const anchor = document.createElement('a');
    anchor.href = url;
    // Out of the layout but still in the document: the click has to bubble to
    // the linker's listener, and `hidden` keeps it from being seen or focused.
    anchor.hidden = true;
    document.body.append(anchor);

    // Left before the navigation, not after: the page is about to be replaced,
    // and this note is what tells the next load to wait before showing a cart
    // the shopper may be buying right now.
    markHandoff();

    // Reported before the click because the page is about to be replaced, and
    // at click time rather than on settle because the spec counts a handoff,
    // not a Draft Order.
    send({ name: 'checkout_redirect', params: { checkout_provider: 'tiendanube' } });
    anchor.click();

    const timer = setTimeout(() => setStalled(true), HANDOFF_STALL_MS);
    return () => {
      clearTimeout(timer);
      anchor.remove();
    };
  }, [url, send]);

  return { stalled };
}
