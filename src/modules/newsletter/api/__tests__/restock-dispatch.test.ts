import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductView } from "@/modules/catalog";
import { restockSubject } from "../../emails/templates/restock";
import { MAX_BATCH_SIZE } from "../mailer";
import { dispatchRestockNotices, type RestockDispatchDependencies } from "../restock-dispatch";
import { createFakeSupabase } from "./fake-supabase";

const PRODUCT_ID = 366252433;
const PENDING = { data: [{ id: "pending" }] };

function variant(id: number, combination: string[], inStock: boolean) {
  return { id, combination, inStock, price: { amount: 2_700_000, currency: "ARS" } };
}

const PRODUCT = {
  id: PRODUCT_ID,
  slug: "remera-oversize",
  title: "Remera Oversize",
  images: [{ id: 1, src: "https://cdn.test/first.jpg", position: 1 }],
  variants: [
    variant(201, ["Negro", "M"], false),
    variant(202, ["Negro", "L"], true),
    variant(204, ["Blanco", "L"], true),
  ],
} as unknown as ProductView;

const claimed = (count: number, variantId = 202, prefix = "row") =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    email: `shopper${index}@example.com`,
    variant_id: variantId,
  }));

type SendBatchResult = { ok: true; ids: string[] } | { ok: false; reason: string };

function setup(
  replies: Parameters<typeof createFakeSupabase>[0],
  overrides: Partial<RestockDispatchDependencies> = {},
) {
  const fake = createFakeSupabase(replies);
  const sendBatch = vi.fn(async (): Promise<SendBatchResult> => ({ ok: true, ids: [] }));
  const getFreshProduct = vi.fn(async () => PRODUCT as ProductView | null);
  const dependencies: RestockDispatchDependencies = {
    createClient: () => fake.client,
    createMailer: () => ({ send: vi.fn(), sendBatch }) as never,
    getFreshProduct,
    getTransferRateBp: async () => 1000,
    siteOrigin: () => "https://flesh.test",
    now: () => new Date("2026-11-03T12:00:00.000Z"),
    ...overrides,
  };
  return { ...fake, dependencies, sendBatch, getFreshProduct };
}

const keyOf = (call: unknown[]) => (call[1] as { idempotencyKey: string }).idempotencyKey;

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("dispatchRestockNotices", () => {
  it("returns before calling Tiendanube when nothing is pending for the product", async () => {
    const { dependencies, calls, getFreshProduct, sendBatch } = setup([{ data: [] }]);

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(getFreshProduct).not.toHaveBeenCalled();
    expect(sendBatch).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ops).toEqual([
      ["select", "id"],
      ["eq", "product_id", PRODUCT_ID],
      ["is", "notified_at", null],
      ["limit", 1],
    ]);
  });

  it("claims only the in-stock variants, marking them notified before sending", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: claimed(1) }]);

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(calls[1]!.table).toBe("restock_requests");
    expect(calls[1]!.ops).toEqual([
      ["update", { notified_at: "2026-11-03T12:00:00.000Z" }],
      ["eq", "product_id", PRODUCT_ID],
      ["in", "variant_id", [202, 204]],
      ["is", "notified_at", null],
      ["select", "id, email, variant_id"],
    ]);
    expect(sendBatch).toHaveBeenCalledTimes(1);
  });

  it("does not claim anything when every variant is still sold out", async () => {
    const soldOut = { ...PRODUCT, variants: [variant(201, ["Negro", "M"], false)] } as unknown as ProductView;
    const { dependencies, calls, sendBatch } = setup([PENDING], { getFreshProduct: async () => soldOut });

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("does nothing for a product that no longer exists", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING], { getFreshProduct: async () => null });

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  // A duplicate delivery finds its rows already claimed: the guarded update
  // matches nothing, which is the whole point of claiming before sending.
  it("sends nothing when the claim returns no rows", async () => {
    const { dependencies, sendBatch } = setup([PENDING, { data: [] }]);

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("builds one restock email per claimed row from the fresh product", async () => {
    const { dependencies, sendBatch } = setup([PENDING, { data: claimed(1) }]);

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    const [messages] = sendBatch.mock.calls[0] as unknown as [
      { to: string; subject: string; react: { props: Record<string, string> }; headers?: unknown }[],
    ];
    expect(messages).toHaveLength(1);
    expect(messages[0]!.to).toBe("shopper0@example.com");
    expect(messages[0]!.subject).toBe(restockSubject("Remera Oversize", "Negro / L"));
    expect(messages[0]!.react.props).toMatchObject({
      baseUrl: "https://flesh.test",
      productName: "Remera Oversize",
      variantLabel: "Negro / L",
      // 10% transfer discount off $27.000, as the storefront shows it.
      price: "$24.300",
      imageUrl: "https://cdn.test/first.jpg",
      productUrl: "https://flesh.test/producto/remera-oversize",
    });
    // A one-off notice the shopper asked for: nothing to unsubscribe from.
    expect(messages[0]!.headers).toBeUndefined();
  });

  it("chunks the batch at the provider limit with a distinct, deterministic key per chunk", async () => {
    const rows = claimed(250);
    const first = setup([PENDING, { data: rows }]);
    const second = setup([PENDING, { data: rows }]);

    await dispatchRestockNotices(PRODUCT_ID, first.dependencies);
    await dispatchRestockNotices(PRODUCT_ID, second.dependencies);

    const sizes = first.sendBatch.mock.calls.map((call) => ((call as unknown[])[0] as unknown[]).length);
    expect(sizes).toEqual([MAX_BATCH_SIZE, MAX_BATCH_SIZE, 50]);
    const keys = first.sendBatch.mock.calls.map(keyOf);
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(key).toMatch(new RegExp(`^restock/${PRODUCT_ID}/[0-9a-f]{24}$`));
    expect(second.sendBatch.mock.calls.map(keyOf)).toEqual(keys);
  });

  it("derives the key from the claimed ids, not from their order", async () => {
    const rows = claimed(3);
    const forward = setup([PENDING, { data: rows }]);
    const reversed = setup([PENDING, { data: [...rows].reverse() }]);

    await dispatchRestockNotices(PRODUCT_ID, forward.dependencies);
    await dispatchRestockNotices(PRODUCT_ID, reversed.dependencies);

    expect(keyOf(reversed.sendBatch.mock.calls[0]!)).toBe(keyOf(forward.sendBatch.mock.calls[0]!));
  });

  it("releases only the rows of a chunk that failed, and still sends the others", async () => {
    const rows = claimed(150);
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: rows }, { data: null }]);
    sendBatch
      .mockResolvedValueOnce({ ok: true, ids: [] })
      .mockResolvedValueOnce({ ok: false, reason: "rate-limited" });

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(sendBatch).toHaveBeenCalledTimes(2);
    expect(calls[2]!.ops).toEqual([
      ["update", { notified_at: null }],
      ["in", "id", rows.slice(MAX_BATCH_SIZE).map((row) => row.id)],
    ]);
    expect(errorLog).toHaveBeenCalledWith("[newsletter] restock_dispatch_failed", { reason: "rate-limited" });
  });

  it("releases the chunk when the mailer throws", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: claimed(2) }, { data: null }]);
    sendBatch.mockRejectedValueOnce(new Error("socket hang up for shopper0@example.com"));

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(calls[2]!.ops[0]).toEqual(["update", { notified_at: null }]);
    expect(errorLog).toHaveBeenCalledWith("[newsletter] restock_dispatch_failed", { reason: "unexpected_error" });
  });

  it("never throws: it runs inside after(), where nobody can handle it", async () => {
    const { dependencies } = setup([{ error: { message: "db down" } }]);

    await expect(dispatchRestockNotices(PRODUCT_ID, dependencies)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] restock_dispatch_failed", {
      reason: "storage_error",
      operation: "restock_pending_lookup",
    });
  });

  it("logs a failed release without the rows it could not free", async () => {
    const { dependencies, sendBatch } = setup([
      PENDING,
      { data: claimed(1) },
      { error: { message: "violates constraint for shopper0@example.com" } },
    ]);
    sendBatch.mockResolvedValueOnce({ ok: false, reason: "network" });

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(errorLog).toHaveBeenCalledWith("[newsletter] restock_release_failed", {
      reason: "storage_error",
      operation: "restock_release",
    });
  });

  it("never writes an email address to the logs", async () => {
    const { dependencies, sendBatch } = setup([
      PENDING,
      { data: claimed(3) },
      { error: { message: "duplicate shopper1@example.com" } },
    ]);
    sendBatch.mockResolvedValueOnce({ ok: false, reason: "rejected" });

    await dispatchRestockNotices(PRODUCT_ID, dependencies);

    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/@example\.com/);
  });
});
