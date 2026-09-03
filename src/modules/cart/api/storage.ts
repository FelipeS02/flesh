import { z } from "zod";
import type {
  StoredCart,
  StoredCartLine,
  StoredCartNotice,
} from "../domain/reconcile";

/**
 * The browser-side persistence adapter for the cart.
 *
 * No `import "server-only"` here, unlike `catalog/api/source.ts`: this is the
 * opposite boundary. `localStorage` exists only in the browser, and
 * `CartProvider` ('use client') is the sole caller.
 *
 * The schemas below are a VALIDATION LAYER over the types `domain/reconcile.ts`
 * already declares — never a second definition of them. Each carries an
 * explicit `z.ZodType<...>` annotation, so the day someone adds a field to
 * `StoredCartLine` and forgets this file, the build fails instead of the codec
 * silently dropping it. This project has already been bitten twice by two
 * copies of one shape drifting apart; a comment asking future readers to keep
 * them in sync is not a mechanism.
 */

/**
 * Versioned on purpose. A future change to the stored shape bumps this, and
 * every record written under the old key becomes unreadable rather than
 * half-decodable — which is the safe direction: a cart silently missing a
 * field is worse than a cart the shopper has to rebuild.
 */
export const CART_STORAGE_KEY = "flesh.cart.v1";

/**
 * `quantity` is `.int().positive()`, not just a number, and that is a real
 * guard rather than tidiness: this value is multiplied by a price to produce a
 * total. A forged `-3` would produce a NEGATIVE subtotal, and a `1.5` would
 * produce a fractional minor unit that breaks the formatter's grouping. The
 * reducer never emits either — it removes a line at zero — so anything else
 * arriving here came from a hand-edited record.
 *
 * `unitPriceMinor` is `.int()` for the same reason `Money.amount` is an
 * integer count by contract (see `catalog/lib/money.ts`).
 */
const StoredCartLineSchema: z.ZodType<StoredCartLine> = z.object({
  productId: z.number().int(),
  variantId: z.number().int(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int(),
  currency: z.string(),
});

/**
 * Three members, not a `discriminatedUnion` on `kind`: two of them share
 * `kind: "removed"` and differ on `reason`, which Zod's discriminated union
 * cannot express with a single discriminator.
 *
 * The `item` asymmetry is preserved exactly as the domain declares it —
 * nullable only for a variant the catalog can no longer name. Widening it to
 * `string | null` everywhere would let a decoded payload carry a null the
 * renderer's types say is impossible.
 */
const StoredCartNoticeSchema: z.ZodType<StoredCartNotice> = z.union([
  z.object({
    kind: z.literal("removed"),
    reason: z.literal("out-of-stock"),
    variantId: z.number().int(),
    item: z.string(),
  }),
  z.object({
    kind: z.literal("removed"),
    reason: z.literal("unknown-variant"),
    variantId: z.number().int(),
    item: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("repriced"),
    variantId: z.number().int(),
    item: z.string(),
    fromMinor: z.number().int(),
    toMinor: z.number().int(),
    currency: z.string(),
  }),
]);

/**
 * The record as it sits on disk: the payload plus its version tag.
 *
 * `notices` defaults to `[]` rather than being required — a record written
 * before notices existed is a real shape, and failing its decode would empty a
 * cart somebody had already filled over a field they never needed.
 *
 * `v` gets no default and no tolerance. An unrecognised version means the
 * shape is not one this build understands, and guessing at it is exactly how
 * a partially-decoded cart reaches a total.
 */
const StoredCartRecordSchema = z.object({
  v: z.literal(1),
  lines: z.array(StoredCartLineSchema),
  notices: z.array(StoredCartNoticeSchema).default([]),
});

/**
 * The three operations the provider needs, all SYNCHRONOUS. `localStorage` is
 * synchronous, and pretending otherwise would make the mount effect await
 * something that already resolved — which is what turns a one-frame
 * rehydration into a visible flash of an empty cart.
 */
export interface CartStoragePort {
  read(): StoredCart | null;
  write(cart: StoredCart): void;
  clear(): void;
}

/** The slice of `Storage` this adapter touches. */
type StorageBacking = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * A factory over an injected backing store, not a module-level singleton
 * reaching for `window.localStorage`.
 *
 * Two reasons, both load-bearing. A singleton would touch `window` at import
 * time, which breaks the moment this module is pulled into a server render.
 * And storage that THROWS — quota exceeded, or a browser configured to block
 * site data — is a real case that has to be tested, and the only honest way to
 * test it is to hand in a store that throws.
 */
export function createCartStorage(backing: StorageBacking): CartStoragePort {
  return {
    /**
     * Every failure path returns `null`, and none of them throws.
     *
     * Malformed JSON, an unknown version, a schema-invalid payload and a
     * browser refusing to hand over storage at all are different causes with
     * one correct response: this adapter cannot vouch for a cart, so there is
     * no cart. The alternative — letting any of them escape — takes down the
     * page render for a shopper whose only mistake was having site data
     * blocked.
     */
    read() {
      let raw: string | null;
      try {
        raw = backing.getItem(CART_STORAGE_KEY);
      } catch {
        return null;
      }

      if (raw === null) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }

      const result = StoredCartRecordSchema.safeParse(parsed);
      if (!result.success) {
        return null;
      }

      // `.safeParse`, not `.parse` — and this is the one place in the repo
      // that deviates from the catalog's throw-first policy on purpose. The
      // catalog parses OUR fixtures, where silence is the risk; this parses a
      // record the visitor's browser holds and anyone can hand-edit, where a
      // throw is the risk.
      const { lines, notices } = result.data;
      return { lines, notices };
    },

    /**
     * An empty cart with no pending notice DELETES the record rather than
     * writing `{lines: [], notices: []}` — design D3's record-lifetime rule.
     * A cart nobody has filled should leave nothing behind.
     *
     * A cart with no lines but a pending notice is NOT empty in the sense that
     * matters: the notice is the whole reason the record survives, and
     * dropping it here loses the "we removed something" message before the
     * shopper ever reads it.
     */
    write(cart) {
      if (cart.lines.length === 0 && cart.notices.length === 0) {
        this.clear();
        return;
      }

      try {
        backing.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({ v: 1, lines: cart.lines, notices: cart.notices }),
        );
      } catch {
        // A failed write is not worth interrupting a purchase over. The cart
        // stays correct in memory for this session and is simply not
        // remembered for the next one, which is the graceful half of the
        // failure rather than the loud one.
      }
    },

    clear() {
      try {
        backing.removeItem(CART_STORAGE_KEY);
      } catch {
        // Same reasoning as `write`: nothing a shopper can act on.
      }
    },
  };
}
