import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredCart } from "../domain/reconcile";
import { CART_STORAGE_KEY, createCartStorage } from "./storage";

/**
 * These tests run against the REAL `window.localStorage` from jsdom wherever
 * they can, and against a hand-built stub only where the behaviour under test
 * is the browser refusing to cooperate — a quota error or storage blocked
 * outright. A mock that merely pretends to be storage would not prove the
 * codec survives a genuine round trip through string serialisation.
 */
function realStorage() {
  return createCartStorage(window.localStorage);
}

/** Storage that throws on every operation — quota exceeded, or blocked. */
function throwingStorage() {
  return createCartStorage({
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
    removeItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  });
}

const line = {
  productId: 101,
  variantId: 201,
  quantity: 2,
  unitPriceMinor: 2_700_000,
  currency: "ARS",
};

const cart: StoredCart = { lines: [line], notices: [] };

function writeRaw(payload: unknown) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    typeof payload === "string" ? payload : JSON.stringify(payload),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("the cart codec", () => {
  it("round-trips lines through storage without changing them", () => {
    const storage = realStorage();

    storage.write(cart);

    expect(storage.read()).toEqual(cart);
  });

  it("round-trips both removal reasons, which carry different item types", () => {
    const storage = realStorage();
    const withRemovals: StoredCart = {
      lines: [],
      notices: [
        {
          kind: "removed",
          reason: "out-of-stock",
          variantId: 201,
          item: "Remera Classic / M, Negro",
        },
        { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
      ],
    };

    storage.write(withRemovals);

    expect(storage.read()).toEqual(withRemovals);
  });

  it("round-trips a repriced notice as flat minor units, not as Money", () => {
    const storage = realStorage();
    const repriced: StoredCart = {
      lines: [],
      notices: [
        {
          kind: "repriced",
          variantId: 201,
          item: "Remera Classic / M",
          fromMinor: 2_700_000,
          toMinor: 3_100_000,
          currency: "ARS",
        },
      ],
    };

    storage.write(repriced);

    expect(storage.read()).toEqual(repriced);
  });

  it("decodes a payload written before notices existed", () => {
    // `.default([])`: a record from an older build has no `notices` key at
    // all. Treating that as a decode failure would silently empty a cart
    // somebody had already filled.
    writeRaw({ v: 1, lines: [line] });

    expect(realStorage().read()).toEqual({ lines: [line], notices: [] });
  });
});

describe("the record's lifetime", () => {
  it("keeps the record when the lines are gone but a notice is still pending", () => {
    // Design D3: the notice is the whole reason the record survives. Deleting
    // it here is what would lose the "we removed something" message before
    // the shopper ever saw it.
    const storage = realStorage();

    storage.write({
      lines: [],
      notices: [
        { kind: "removed", reason: "unknown-variant", variantId: 999, item: null },
      ],
    });

    expect(window.localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
    expect(storage.read()?.notices).toHaveLength(1);
  });

  it("deletes the record when there is nothing left to remember", () => {
    const storage = realStorage();
    storage.write(cart);

    storage.write({ lines: [], notices: [] });

    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(storage.read()).toBeNull();
  });

  it("clears on request", () => {
    const storage = realStorage();
    storage.write(cart);

    storage.clear();

    expect(storage.read()).toBeNull();
  });
});

describe("a notice survives a reload, and a dismissal survives one too", () => {
  it("still holds the notice after the provider is discarded and storage re-read", () => {
    realStorage().write({
      lines: [],
      notices: [
        { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Remera" },
      ],
    });

    // A "reload" here is a brand-new adapter over the same backing store —
    // no in-memory state carried across, which is the only part of a reload
    // this harness can honestly reproduce.
    expect(realStorage().read()?.notices).toHaveLength(1);
  });

  it("has forgotten a dismissed notice after the same round trip", () => {
    const first = realStorage();
    first.write({
      lines: [line],
      notices: [
        { kind: "removed", reason: "out-of-stock", variantId: 201, item: "Remera" },
      ],
    });

    // Dismissal is a WRITE-THROUGH, per design D4 — dropping it from React
    // state alone would bring the notice back on the next reload.
    first.write({ lines: [line], notices: [] });

    expect(realStorage().read()?.notices).toEqual([]);
  });
});

/**
 * Everything below is the threat matrix (tasks 2a.7–2a.9). The rule they all
 * share: a payload this adapter cannot vouch for is ABSENT, never partially
 * trusted and never an exception escaping into the provider. A cart that
 * crashes the page because storage was disabled is worse than no cart.
 */
describe("hostile and broken payloads are absent, never thrown", () => {
  it("treats an unknown schema version as absent", () => {
    writeRaw({ v: 99, lines: [line], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("treats a missing schema version as absent", () => {
    writeRaw({ lines: [line], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("treats malformed JSON as absent", () => {
    writeRaw("{not json at all");

    expect(realStorage().read()).toBeNull();
  });

  it("treats a schema-invalid payload as absent", () => {
    writeRaw({ v: 1, lines: [{ productId: "not a number" }], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("survives storage that throws on read", () => {
    expect(() => throwingStorage().read()).not.toThrow();
    expect(throwingStorage().read()).toBeNull();
  });

  it("survives storage that throws on write, the way a full quota does", () => {
    expect(() => throwingStorage().write(cart)).not.toThrow();
  });

  it("survives storage that throws on clear", () => {
    expect(() => throwingStorage().clear()).not.toThrow();
  });

  it("rejects a negative quantity rather than letting it reach a total", () => {
    writeRaw({ v: 1, lines: [{ ...line, quantity: -3 }], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("rejects a fractional quantity", () => {
    writeRaw({ v: 1, lines: [{ ...line, quantity: 1.5 }], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("rejects a zero quantity, which no live line ever has", () => {
    writeRaw({ v: 1, lines: [{ ...line, quantity: 0 }], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("rejects a fractional price witness, which Money forbids by contract", () => {
    writeRaw({ v: 1, lines: [{ ...line, unitPriceMinor: 1.5 }], notices: [] });

    expect(realStorage().read()).toBeNull();
  });

  it("keeps a forged item string as plain text, with no markup meaning", () => {
    // The label is rendered as text content by `notices.tsx` (task 3b.5), so
    // the codec's job is only to refuse to interpret it. It decodes as the
    // string it is — the same characters back, nothing stripped, nothing run.
    const forged = '<img src=x onerror="alert(1)">';
    writeRaw({
      v: 1,
      lines: [],
      notices: [
        { kind: "removed", reason: "out-of-stock", variantId: 201, item: forged },
      ],
    });

    const decoded = realStorage().read();

    expect(decoded?.notices[0]).toMatchObject({ item: forged });
    expect(typeof (decoded?.notices[0] as { item: string }).item).toBe("string");
  });

  it("decodes repriced amounts as integers only, never as strings to be re-parsed", () => {
    writeRaw({
      v: 1,
      lines: [],
      notices: [
        {
          kind: "repriced",
          variantId: 201,
          item: "Remera",
          fromMinor: "2700000",
          toMinor: 3_100_000,
          currency: "ARS",
        },
      ],
    });

    expect(realStorage().read()).toBeNull();
  });
});

describe("the storage key", () => {
  it("is versioned, so a future shape change cannot read this one's records", () => {
    expect(CART_STORAGE_KEY).toBe("flesh.cart.v1");
  });

  it("writes under exactly that key and nothing else", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    realStorage().write(cart);

    expect(setItem).toHaveBeenCalledWith(CART_STORAGE_KEY, expect.any(String));
    setItem.mockRestore();
  });
});
