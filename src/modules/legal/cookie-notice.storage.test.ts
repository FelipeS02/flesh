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
});
