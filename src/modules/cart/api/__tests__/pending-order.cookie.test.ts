import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_ORDER_COOKIE_NAME,
  clearPendingOrderCookie,
  readPendingOrderCookie,
  writePendingOrderCookie,
} from "../pending-order.cookie";

function fakeStore(initial?: string) {
  const set = vi.fn();
  return {
    set,
    store: {
      get: (name: string) =>
        name === PENDING_ORDER_COOKIE_NAME && initial !== undefined
          ? { value: initial }
          : undefined,
      set,
    },
  };
}

describe("writePendingOrderCookie", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  // httpOnly is the whole security argument for this cookie: the browser must
  // not be able to name an order id, or the check endpoint would answer for any
  // id it was handed and leak which orders exist.
  it("keeps the id out of reach of the browser, scoped to the site for a day", async () => {
    const { store, set } = fakeStore();

    await writePendingOrderCookie(2_070_706_008, store);

    expect(set).toHaveBeenCalledWith(
      PENDING_ORDER_COOKIE_NAME,
      "2070706008",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86_400,
      }),
    );
  });

  // Derived rather than hardcoded: http://localhost does not reliably keep a
  // secure cookie, so a hardcoded true works in production and looks broken in
  // development.
  it("marks the cookie secure only in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const production = fakeStore();
    await writePendingOrderCookie(1, production.store);
    expect(production.set).toHaveBeenCalledWith(
      PENDING_ORDER_COOKIE_NAME,
      "1",
      expect.objectContaining({ secure: true }),
    );

    vi.stubEnv("NODE_ENV", "development");
    const development = fakeStore();
    await writePendingOrderCookie(1, development.store);
    expect(development.set).toHaveBeenCalledWith(
      PENDING_ORDER_COOKIE_NAME,
      "1",
      expect.objectContaining({ secure: false }),
    );
  });
});

describe("readPendingOrderCookie", () => {
  it("returns the pending id when one was recorded", async () => {
    const { store } = fakeStore("2070706008");

    await expect(readPendingOrderCookie(store)).resolves.toBe(2_070_706_008);
  });

  it("reports nothing pending when no handoff was recorded", async () => {
    const { store } = fakeStore();

    await expect(readPendingOrderCookie(store)).resolves.toBeNull();
  });

  // A tampered cookie means "nothing pending", never a thrown request or a
  // lookup against a forged id.
  it.each([
    ["empty", ""],
    ["non-numeric", "not-an-id"],
    ["negative", "-5"],
    ["fractional", "12.5"],
    ["padded with a sign", "+7"],
    ["beyond safe integer range", "9007199254740993"],
  ])("treats a %s value as nothing pending", async (_label, value) => {
    const { store } = fakeStore(value);

    await expect(readPendingOrderCookie(store)).resolves.toBeNull();
  });
});

describe("clearPendingOrderCookie", () => {
  it("expires the cookie in place, so a spent answer is never asked for twice", async () => {
    const { store, set } = fakeStore("2070706008");

    await clearPendingOrderCookie(store);

    expect(set).toHaveBeenCalledWith(
      PENDING_ORDER_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0, httpOnly: true, path: "/" }),
    );
  });
});
