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
  /**
   * Whether the notice is out of the way for THIS page lifetime: stored from
   * a previous visit, or acknowledged since load even if the write failed.
   * Distinct from `acknowledged()` on purpose — that one answers "should the
   * notice show next visit" and stays false on a browser blocking storage,
   * which would leave anything waiting on the notice (the newsletter banner)
   * waiting forever.
   */
  settled(): boolean;
  /**
   * Same-tab change feed for `acknowledge()`. The `storage` DOM event only
   * fires in OTHER tabs, so it cannot tell the banner that the notice beside
   * it was just closed.
   */
  subscribe(listener: () => void): () => void;
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
  const listeners = new Set<() => void>();
  let acknowledgedThisPage = false;

  /**
   * A browser refusing to hand over storage answers "not acknowledged", so
   * the notice shows again on the next visit. That is the safe direction:
   * showing a notice twice costs a shopper one click, while swallowing the
   * error the other way would hide a legal notice from someone who never
   * saw it.
   */
  function acknowledged(): boolean {
    try {
      return backing.getItem(COOKIE_NOTICE_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  return {
    acknowledged,

    settled() {
      return acknowledgedThisPage || acknowledged();
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * Never throws. A write that fails leaves the notice dismissed for THIS
     * session anyway — the component's own state has already moved on — and
     * the shopper sees it again next visit. Letting the exception escape would
     * take down the render of whatever is mounted around it, which is a far
     * worse outcome than a notice that reappears.
     */
    acknowledge() {
      acknowledgedThisPage = true;

      try {
        backing.setItem(COOKIE_NOTICE_STORAGE_KEY, ACKNOWLEDGED);
      } catch {
        // Intentionally swallowed; see above.
      }

      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          // One misbehaving subscriber must not starve the others, nor undo
          // a dismissal that is already written.
        }
      }
    },
  };
}

let browserStorage: CookieNoticeStorage | null = null;

/**
 * THE instance the notice and the newsletter banner share. It has to be one
 * object: the subscription lives inside the adapter, so two adapters over the
 * same `localStorage` would acknowledge without ever telling each other.
 *
 * Lazy and module-cached, never built at import time, for the reason
 * `createCookieNoticeStorage` gives: only call it from client-only paths.
 */
export function browserCookieNoticeStorage(): CookieNoticeStorage {
  // Lazy accessors: reading `window.localStorage` itself can throw when site
  // data is blocked, and that must land inside the adapter's try/catch.
  return (browserStorage ??= createCookieNoticeStorage({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  }));
}
