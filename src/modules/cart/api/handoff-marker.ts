/**
 * A browser-local note that this visitor was handed off to the hosted checkout.
 *
 * It exists to answer one question SYNCHRONOUSLY at mount: is it worth waiting
 * before showing the cart? The real answer — whether the order was actually
 * placed — only the server can give, and asking for it takes a round trip. With
 * no marker the cart renders immediately, exactly as it always did, and no
 * request is made at all; with one, the cart waits rather than showing lines the
 * shopper may have just bought.
 *
 * Deliberately its OWN key rather than a field on the stored cart: that record
 * has a versioned schema, and adding to it would bump the version and make every
 * cart already in a shopper's browser unreadable.
 */
const HANDOFF_MARKER_KEY = "flesh.cart.handoff.v1";

/**
 * Every access is guarded. `localStorage` throws outright in some privacy modes
 * and when site data is blocked, and none of this is worth breaking a page over
 * — the honest fallback is "no handoff pending", which just renders the cart.
 */
export function markHandoff(): void {
  try {
    window.localStorage.setItem(HANDOFF_MARKER_KEY, "1");
  } catch {
    // Nothing to do: the cart simply renders without waiting.
  }
}

export function hasHandoffMarker(): boolean {
  try {
    return window.localStorage.getItem(HANDOFF_MARKER_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearHandoffMarker(): void {
  try {
    window.localStorage.removeItem(HANDOFF_MARKER_KEY);
  } catch {
    // Same as above. A marker that cannot be removed only costs one extra
    // check on the next load, which resolves to "not purchased" and moves on.
  }
}
