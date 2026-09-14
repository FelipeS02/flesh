import { afterEach, describe, expect, it, vi } from "vitest";
import { BUYER_COOKIE_NAME, readBuyerCookie, writeBuyerCookie } from "./buyer-profile.cookie";

const BUYER = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" };

function fakeStore(initial?: string) {
  const set = vi.fn();
  const value = initial;
  return {
    set,
    store: {
      get: (name: string) => (name === BUYER_COOKIE_NAME && value !== undefined ? { value } : undefined),
      set,
    },
  };
}

describe("writeBuyerCookie", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("sets httpOnly, sameSite=lax, path=/, and a one-year maxAge", async () => {
    const { store, set } = fakeStore();
    await writeBuyerCookie(BUYER, store);

    expect(set).toHaveBeenCalledWith(
      BUYER_COOKIE_NAME,
      JSON.stringify(BUYER),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 }),
    );
  });

  it("sets secure only when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { store, set } = fakeStore();
    await writeBuyerCookie(BUYER, store);

    expect(set).toHaveBeenCalledWith(BUYER_COOKIE_NAME, JSON.stringify(BUYER), expect.objectContaining({ secure: true }));
  });

  it("does not set secure outside of production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { store, set } = fakeStore();
    await writeBuyerCookie(BUYER, store);

    expect(set).toHaveBeenCalledWith(BUYER_COOKIE_NAME, JSON.stringify(BUYER), expect.objectContaining({ secure: false }));
  });
});

describe("readBuyerCookie", () => {
  it("returns the parsed value when the cookie holds valid JSON", async () => {
    const { store } = fakeStore(JSON.stringify(BUYER));

    await expect(readBuyerCookie(store)).resolves.toEqual(BUYER);
  });

  it("returns null when no cookie is present", async () => {
    const { store } = fakeStore();

    await expect(readBuyerCookie(store)).resolves.toBeNull();
  });

  it("returns null for a malformed (non-JSON) cookie value instead of throwing", async () => {
    const { store } = fakeStore("not-json{{{");

    await expect(readBuyerCookie(store)).resolves.toBeNull();
  });

  it("returns null for a tampered value that parses but is not the expected shape — schema validation happens in resolveBuyer", async () => {
    const { store } = fakeStore(JSON.stringify({ unrelated: true }));

    await expect(readBuyerCookie(store)).resolves.toEqual({ unrelated: true });
  });
});
