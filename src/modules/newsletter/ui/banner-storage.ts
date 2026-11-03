/**
 * Versioned like `COOKIE_NOTICE_STORAGE_KEY`: bumping the suffix is the only
 * way to make everyone's earlier "no thanks" stop counting.
 */
export const BANNER_SESSION_KEY = "flesh.newsletter-banner.session-start.v1";
export const BANNER_DISMISSED_KEY = "flesh.newsletter-banner.dismissed-at.v1";
export const BANNER_SUBSCRIBED_KEY = "flesh.newsletter-banner.subscribed.v1";

/** The slice of `Storage` this adapter touches. */
type StorageBacking = Pick<Storage, "getItem" | "setItem">;

export interface BannerStorage {
  /**
   * When this browsing session began. The first call stamps `now`; later calls
   * (including after a reload, which shares `sessionStorage`) return that
   * stamp, so navigating never restarts the 10 s clock.
   */
  sessionStart(now: number): number;
  dismissedAt(): number | null;
  dismiss(now: number): void;
  subscribed(): boolean;
  markSubscribed(): void;
}

function readNumber(backing: StorageBacking, key: string): number | null {
  try {
    const raw = backing.getItem(key);
    if (raw === null) return null;

    const value = Number(raw);

    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function write(backing: StorageBacking, key: string, value: string): void {
  try {
    backing.setItem(key, value);
  } catch {
    // Quota or blocked site data: the banner simply forgets, which costs a
    // shopper one extra appearance. Throwing would take the whole layout down.
  }
}

/**
 * A factory over injected backings, for the reasons `createCookieNoticeStorage`
 * gives (no `window` at import time; a throwing store is only testable by
 * handing one in). Two backings because the facts have different lifetimes:
 * the session clock must die with the tab, while a dismissal or a
 * subscription must outlive it.
 */
export function createBannerStorage(backings: {
  local: StorageBacking;
  session: StorageBacking;
}): BannerStorage {
  const { local, session } = backings;
  // Fallback for a blocked `sessionStorage`: without it every call would
  // stamp a fresh `now` and the banner would never come due.
  let memoryStart: number | null = null;

  return {
    sessionStart(now) {
      const stored = readNumber(session, BANNER_SESSION_KEY);
      if (stored !== null) return stored;
      if (memoryStart !== null) return memoryStart;

      memoryStart = now;
      write(session, BANNER_SESSION_KEY, String(now));

      return now;
    },

    dismissedAt() {
      return readNumber(local, BANNER_DISMISSED_KEY);
    },

    dismiss(now) {
      write(local, BANNER_DISMISSED_KEY, String(now));
    },

    subscribed() {
      try {
        return local.getItem(BANNER_SUBSCRIBED_KEY) !== null;
      } catch {
        return false;
      }
    },

    markSubscribed() {
      write(local, BANNER_SUBSCRIBED_KEY, "1");
    },
  };
}

let browserStorage: BannerStorage | null = null;

/** Lazy and cached; call only from client-only paths (effects, handlers). */
export function browserBannerStorage(): BannerStorage {
  // Lazy accessors, not `window.localStorage` evaluated here: in some browsers
  // merely READING that property throws when site data is blocked, and this
  // line would then escape the adapters' own try/catch.
  return (browserStorage ??= createBannerStorage({
    local: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    session: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
    },
  }));
}
