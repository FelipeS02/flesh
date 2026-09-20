/**
 * Versioned for the same reason `CART_STORAGE_KEY` is: the day the notice's
 * text changes in a way shoppers ought to see again, the key is bumped and
 * every previous acknowledgement stops counting. That is the only mechanism
 * that can re-show this — there is no "re-ask" flow, because there is nothing
 * to ask.
 */
export const COOKIE_NOTICE_STORAGE_KEY = "flesh.cookie-notice.v1";

/**
 * Presence IS the fact, so the value is never read — only whether the key is
 * there. No schema, and deliberately no shape to decode: a boolean stored as
 * JSON would invite a future field, and a cookie notice that starts carrying
 * per-category preferences is a different feature that must not arrive by
 * accident through this key.
 */
const ACKNOWLEDGED = "1";

export interface CookieNoticeStorage {
  acknowledged(): boolean;
  acknowledge(): void;
}

/** The slice of `Storage` this adapter touches. */
type StorageBacking = Pick<Storage, "getItem" | "setItem">;

/**
 * A factory over an injected backing store, not a singleton reaching for
 * `window.localStorage` — the same two reasons `createCartStorage` gives: a
 * singleton would touch `window` at import time and break a server render,
 * and a store that THROWS (quota, or a browser blocking site data) is a real
 * case that can only be tested by handing in one that throws.
 */
export function createCookieNoticeStorage(backing: StorageBacking): CookieNoticeStorage {
  return {
    /**
     * A browser refusing to hand over storage answers "not acknowledged", so
     * the notice shows again on the next visit. That is the safe direction:
     * showing a notice twice costs a shopper one click, while swallowing the
     * error the other way would hide a legal notice from someone who never
     * saw it.
     */
    acknowledged() {
      try {
        return backing.getItem(COOKIE_NOTICE_STORAGE_KEY) !== null;
      } catch {
        return false;
      }
    },

    /**
     * Never throws. A write that fails leaves the notice dismissed for THIS
     * session anyway — the component's own state has already moved on — and
     * the shopper sees it again next visit. Letting the exception escape would
     * take down the render of whatever is mounted around it, which is a far
     * worse outcome than a notice that reappears.
     */
    acknowledge() {
      try {
        backing.setItem(COOKIE_NOTICE_STORAGE_KEY, ACKNOWLEDGED);
      } catch {
        // Intentionally swallowed; see above.
      }
    },
  };
}
