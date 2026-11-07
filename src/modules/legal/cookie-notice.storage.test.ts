import { describe, expect, it, vi } from "vitest";
import {
  COOKIE_NOTICE_STORAGE_KEY,
  createCookieNoticeStorage,
} from "./cookie-notice.storage";

function memoryBacking(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    store,
  };
}

const throwingBacking = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota", "QuotaExceededError");
  },
};

describe("createCookieNoticeStorage", () => {
  it("reports an acknowledgement only once one has been written", () => {
    const backing = memoryBacking();
    const storage = createCookieNoticeStorage(backing);

    expect(storage.acknowledged()).toBe(false);

    storage.acknowledge();

    expect(storage.acknowledged()).toBe(true);
    expect(backing.store.has(COOKIE_NOTICE_STORAGE_KEY)).toBe(true);
  });

  // Presence is the whole contract, so a record written by an older build —
  // or by hand — counts whatever it says. Decoding the value would be the
  // first step towards this key carrying preferences it must not carry.
  it("treats any stored value as an acknowledgement", () => {
    const storage = createCookieNoticeStorage(
      memoryBacking({ [COOKIE_NOTICE_STORAGE_KEY]: "anything at all" }),
    );

    expect(storage.acknowledged()).toBe(true);
  });

  // A browser with site data blocked throws on both operations. Answering
  // "not acknowledged" shows the notice again, which is the safe direction:
  // the other way silently hides a legal notice from someone who never saw
  // it.
  it("shows the notice again rather than throwing when storage is blocked", () => {
    const storage = createCookieNoticeStorage(throwingBacking);

    expect(() => storage.acknowledge()).not.toThrow();
    expect(storage.acknowledged()).toBe(false);
  });

  it("writes exactly one key and never reads the value back", () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();

    const storage = createCookieNoticeStorage({ getItem, setItem });
    storage.acknowledge();

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]?.[0]).toBe(COOKIE_NOTICE_STORAGE_KEY);
  });

  describe("settled / subscribe", () => {
    // The banner must not wait forever on a browser that blocks site data:
    // `acknowledged()` stays false there on purpose (the notice returns next
    // visit), but within THIS page lifetime the shopper did acknowledge it.
    it("counts an acknowledgement as settled for this page even when the write fails", () => {
      const storage = createCookieNoticeStorage(throwingBacking);

      expect(storage.settled()).toBe(false);

      storage.acknowledge();

      expect(storage.settled()).toBe(true);
      expect(storage.acknowledged()).toBe(false);
    });

    it("is settled from the start when a previous visit acknowledged", () => {
      const storage = createCookieNoticeStorage(
        memoryBacking({ [COOKIE_NOTICE_STORAGE_KEY]: "1" }),
      );

      expect(storage.settled()).toBe(true);
    });

    it("notifies subscribers in the same tab when the notice is acknowledged", () => {
      const storage = createCookieNoticeStorage(memoryBacking());
      const listener = vi.fn();

      storage.subscribe(listener);
      storage.acknowledge();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("stops notifying once unsubscribed", () => {
      const storage = createCookieNoticeStorage(memoryBacking());
      const listener = vi.fn();

      storage.subscribe(listener)();
      storage.acknowledge();

      expect(listener).not.toHaveBeenCalled();
    });

    // A listener that throws must not take the notice's own dismissal down
    // with it: the write has already happened by then.
    it("keeps notifying the rest when one subscriber throws", () => {
      const storage = createCookieNoticeStorage(memoryBacking());
      const survivor = vi.fn();

      storage.subscribe(() => {
        throw new Error("boom");
      });
      storage.subscribe(survivor);

      expect(() => storage.acknowledge()).not.toThrow();
      expect(survivor).toHaveBeenCalledTimes(1);
    });
  });
});
