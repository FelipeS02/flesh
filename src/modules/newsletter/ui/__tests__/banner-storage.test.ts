import { describe, expect, it } from "vitest";
import {
  BANNER_DISMISSED_KEY,
  BANNER_SESSION_KEY,
  BANNER_SUBSCRIBED_KEY,
  createBannerStorage,
} from "../banner-storage";

function memory(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    store,
  };
}

const blocked = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota", "QuotaExceededError");
  },
};

describe("createBannerStorage", () => {
  describe("sessionStart", () => {
    it("stamps the first call and keeps answering with that stamp", () => {
      const session = memory();
      const storage = createBannerStorage({ local: memory(), session });

      expect(storage.sessionStart(5_000)).toBe(5_000);
      expect(storage.sessionStart(9_000)).toBe(5_000);
      expect(session.store.get(BANNER_SESSION_KEY)).toBe("5000");
    });

    // A client navigation remounts nothing (the banner lives in the layout)
    // but a full reload builds a new adapter over the same sessionStorage;
    // the clock must not restart there either.
    it("continues the clock of a session another page load started", () => {
      const session = memory({ [BANNER_SESSION_KEY]: "1000" });

      expect(createBannerStorage({ local: memory(), session }).sessionStart(50_000)).toBe(1_000);
    });

    it("ignores a garbled stamp instead of propagating NaN into the timer", () => {
      const session = memory({ [BANNER_SESSION_KEY]: "soon" });

      expect(createBannerStorage({ local: memory(), session }).sessionStart(7_000)).toBe(7_000);
    });

    it("still counts from the first call when sessionStorage is blocked", () => {
      const storage = createBannerStorage({ local: memory(), session: blocked });

      expect(storage.sessionStart(2_000)).toBe(2_000);
      expect(storage.sessionStart(8_000)).toBe(2_000);
    });
  });

  describe("dismissal", () => {
    it("starts undismissed and remembers the moment of the X", () => {
      const local = memory();
      const storage = createBannerStorage({ local, session: memory() });

      expect(storage.dismissedAt()).toBeNull();

      storage.dismiss(123_456);

      expect(storage.dismissedAt()).toBe(123_456);
      expect(local.store.get(BANNER_DISMISSED_KEY)).toBe("123456");
    });

    it("reads a dismissal written by an earlier visit", () => {
      const local = memory({ [BANNER_DISMISSED_KEY]: "42" });

      expect(createBannerStorage({ local, session: memory() }).dismissedAt()).toBe(42);
    });

    it("treats a garbled value as never dismissed", () => {
      const local = memory({ [BANNER_DISMISSED_KEY]: "x" });

      expect(createBannerStorage({ local, session: memory() }).dismissedAt()).toBeNull();
    });
  });

  describe("subscription", () => {
    it("is remembered once marked", () => {
      const local = memory();
      const storage = createBannerStorage({ local, session: memory() });

      expect(storage.subscribed()).toBe(false);

      storage.markSubscribed();

      expect(storage.subscribed()).toBe(true);
      expect(local.store.has(BANNER_SUBSCRIBED_KEY)).toBe(true);
    });
  });

  // Private mode and "block all site data" are real configurations: every
  // operation has to degrade to "nothing remembered", never to an exception
  // that takes the layout down with it.
  describe("when the browser blocks storage", () => {
    it("never throws and answers with the neutral value", () => {
      const storage = createBannerStorage({ local: blocked, session: blocked });

      expect(() => storage.dismiss(1)).not.toThrow();
      expect(() => storage.markSubscribed()).not.toThrow();
      expect(storage.dismissedAt()).toBeNull();
      expect(storage.subscribed()).toBe(false);
    });
  });
});
