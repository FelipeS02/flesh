import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductView } from "@/modules/catalog";
import { launchSubject } from "../../emails/templates/launch";
import { dispatchLaunchNotices, type LaunchDispatchDependencies } from "../launch-dispatch";
import { MAX_BATCH_SIZE } from "../mailer";
import { createFakeSupabase } from "./fake-supabase";

const PRODUCT_ID = 366252433;
const PENDING = { data: [{ id: "pending" }] };

function variant(id: number, inStock: boolean, amount = 2_700_000) {
  return { id, combination: ["Negro", "M"], inStock, price: { amount, currency: "ARS" } };
}

function productWith(variants: ReturnType<typeof variant>[]) {
  return {
    id: PRODUCT_ID,
    slug: "remera-oversize",
    title: "Remera Oversize",
    images: [{ id: 1, src: "https://cdn.test/first.jpg", position: 1 }],
    variants,
  } as unknown as ProductView;
}

const PRODUCT = productWith([variant(201, false), variant(202, true), variant(204, true)]);

const claimed = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `row-${index}`, email: `shopper${index}@example.com` }));

type SendBatchResult = { ok: true; ids: string[] } | { ok: false; reason: string };

function setup(
  replies: Parameters<typeof createFakeSupabase>[0],
  overrides: Partial<LaunchDispatchDependencies> = {},
) {
  const fake = createFakeSupabase(replies);
  const sendBatch = vi.fn(async (): Promise<SendBatchResult> => ({ ok: true, ids: [] }));
  const getFreshProduct = vi.fn(async () => PRODUCT as ProductView | null);
  const isInPreview = vi.fn(async () => false);
  const dependencies: LaunchDispatchDependencies = {
    createClient: () => fake.client,
    createMailer: () => ({ send: vi.fn(), sendBatch }) as never,
    getFreshProduct,
    isInPreview,
    getTransferRateBp: async () => 1000,
    siteOrigin: () => "https://flesh.test",
    now: () => new Date("2026-11-03T12:00:00.000Z"),
    ...overrides,
  };
  return { ...fake, dependencies, sendBatch, getFreshProduct, isInPreview };
}

const keyOf = (call: unknown[]) => (call[1] as { idempotencyKey: string }).idempotencyKey;
type Sent = { to: string; subject: string; react: { props: Record<string, string> }; headers?: unknown }[];

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("dispatchLaunchNotices", () => {
  it("returns before calling Tiendanube when nobody is waiting on the product", async () => {
    const { dependencies, calls, getFreshProduct, isInPreview, sendBatch } = setup([{ data: [] }]);

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(isInPreview).not.toHaveBeenCalled();
    expect(getFreshProduct).not.toHaveBeenCalled();
    expect(sendBatch).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe("product_launch_requests");
    expect(calls[0]!.ops).toEqual([
      ["select", "id"],
      ["eq", "product_id", PRODUCT_ID],
      ["is", "notified_at", null],
      ["limit", 1],
    ]);
  });

  // Every edit to an unreleased product fires the webhook; the rows must stay
  // pending until the owner actually turns the preview off.
  it("claims nothing while the product is still in preview", async () => {
    const { dependencies, calls, getFreshProduct, sendBatch } = setup([PENDING], { isInPreview: async () => true });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(getFreshProduct).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("claims and sends nothing when the preview check fails, leaving rows pending", async () => {
    const { dependencies, calls, getFreshProduct, sendBatch } = setup([PENDING], {
      isInPreview: async () => {
        throw new Error("Tiendanube request failed for custom field preview with status 500.");
      },
    });

    await expect(dispatchLaunchNotices(PRODUCT_ID, dependencies)).resolves.toBeUndefined();

    expect(getFreshProduct).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] launch_dispatch_failed", { reason: "unexpected_error" });
  });

  it("does nothing for a product that no longer exists", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING], { getFreshProduct: async () => null });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  // A launch mail for something nobody can buy is worse than waiting: the next
  // product/updated (the restock) retries because the rows stay pending.
  it("claims nothing when the product is live but nothing is in stock", async () => {
    const soldOut = productWith([variant(201, false)]);
    const { dependencies, calls, sendBatch } = setup([PENDING], { getFreshProduct: async () => soldOut });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(calls).toHaveLength(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("marks every pending row of the product notified before sending", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: claimed(1) }]);

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(calls[1]!.table).toBe("product_launch_requests");
    expect(calls[1]!.ops).toEqual([
      ["update", { notified_at: "2026-11-03T12:00:00.000Z" }],
      ["eq", "product_id", PRODUCT_ID],
      ["is", "notified_at", null],
      ["select", "id, email"],
    ]);
    expect(sendBatch).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the claim returns no rows", async () => {
    const { dependencies, sendBatch } = setup([PENDING, { data: [] }]);

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("builds one launch email per claimed row from the fresh product", async () => {
    const { dependencies, sendBatch } = setup([PENDING, { data: claimed(2) }]);

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    const [messages] = sendBatch.mock.calls[0] as unknown as [Sent];
    expect(messages.map((message) => message.to)).toEqual(["shopper0@example.com", "shopper1@example.com"]);
    expect(messages[0]!.subject).toBe(launchSubject("Remera Oversize"));
    expect(messages[0]!.react.props).toMatchObject({
      baseUrl: "https://flesh.test",
      productName: "Remera Oversize",
      // 10% transfer discount off $27.000, as the storefront shows it.
      price: "$24.300",
      imageUrl: "https://cdn.test/first.jpg",
      productUrl: "https://flesh.test/producto/remera-oversize",
    });
    // A one-off notice the shopper asked for: nothing to unsubscribe from.
    expect(messages[0]!.headers).toBeUndefined();
  });

  it("falls back to the logotype when the product has no image", async () => {
    const bare = { ...PRODUCT, images: [] } as unknown as ProductView;
    const { dependencies, sendBatch } = setup([PENDING, { data: claimed(1) }], { getFreshProduct: async () => bare });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    const [messages] = sendBatch.mock.calls[0] as unknown as [Sent];
    expect(messages[0]!.react.props.imageUrl).toBe("https://flesh.test/email/logotype.png");
  });

  it("prefixes the price with Desde only when in-stock prices differ, using the cheapest", async () => {
    const mixed = productWith([variant(201, true, 3_000_000), variant(202, true, 2_700_000), variant(203, false, 100)]);
    const { dependencies, sendBatch } = setup([PENDING, { data: claimed(1) }], { getFreshProduct: async () => mixed });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    const [messages] = sendBatch.mock.calls[0] as unknown as [Sent];
    expect(messages[0]!.react.props.price).toBe("Desde $24.300");
  });

  it("ignores a sold-out variant price when deciding on Desde", async () => {
    const sameInStock = productWith([variant(201, true), variant(202, true), variant(203, false, 100)]);
    const { dependencies, sendBatch } = setup([PENDING, { data: claimed(1) }], {
      getFreshProduct: async () => sameInStock,
    });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    const [messages] = sendBatch.mock.calls[0] as unknown as [Sent];
    expect(messages[0]!.react.props.price).toBe("$24.300");
  });

  it("chunks the batch at the provider limit with a distinct, deterministic key per chunk", async () => {
    const rows = claimed(250);
    const first = setup([PENDING, { data: rows }]);
    const second = setup([PENDING, { data: rows }]);

    await dispatchLaunchNotices(PRODUCT_ID, first.dependencies);
    await dispatchLaunchNotices(PRODUCT_ID, second.dependencies);

    const sizes = first.sendBatch.mock.calls.map((call) => ((call as unknown[])[0] as unknown[]).length);
    expect(sizes).toEqual([MAX_BATCH_SIZE, MAX_BATCH_SIZE, 50]);
    const keys = first.sendBatch.mock.calls.map(keyOf);
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(key).toMatch(new RegExp(`^launch/${PRODUCT_ID}/[0-9a-f]{24}$`));
    expect(second.sendBatch.mock.calls.map(keyOf)).toEqual(keys);
  });

  it("derives the key from the claimed ids, not from their order", async () => {
    const rows = claimed(3);
    const forward = setup([PENDING, { data: rows }]);
    const reversed = setup([PENDING, { data: [...rows].reverse() }]);

    await dispatchLaunchNotices(PRODUCT_ID, forward.dependencies);
    await dispatchLaunchNotices(PRODUCT_ID, reversed.dependencies);

    expect(keyOf(reversed.sendBatch.mock.calls[0]!)).toBe(keyOf(forward.sendBatch.mock.calls[0]!));
  });

  it("releases only the rows of a chunk that failed, and still sends the others", async () => {
    const rows = claimed(150);
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: rows }, { data: null }]);
    sendBatch
      .mockResolvedValueOnce({ ok: true, ids: [] })
      .mockResolvedValueOnce({ ok: false, reason: "rate-limited" });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(sendBatch).toHaveBeenCalledTimes(2);
    expect(calls[2]!.ops).toEqual([
      ["update", { notified_at: null }],
      ["in", "id", rows.slice(MAX_BATCH_SIZE).map((row) => row.id)],
    ]);
    expect(errorLog).toHaveBeenCalledWith("[newsletter] launch_dispatch_failed", { reason: "rate-limited" });
  });

  it("releases the chunk when the mailer throws", async () => {
    const { dependencies, calls, sendBatch } = setup([PENDING, { data: claimed(2) }, { data: null }]);
    sendBatch.mockRejectedValueOnce(new Error("socket hang up for shopper0@example.com"));

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(calls[2]!.ops[0]).toEqual(["update", { notified_at: null }]);
    expect(errorLog).toHaveBeenCalledWith("[newsletter] launch_dispatch_failed", { reason: "unexpected_error" });
  });

  it("never throws: it runs inside after(), where nobody can handle it", async () => {
    const { dependencies } = setup([{ error: { message: "db down" } }]);

    await expect(dispatchLaunchNotices(PRODUCT_ID, dependencies)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] launch_dispatch_failed", {
      reason: "storage_error",
      operation: "launch_pending_lookup",
    });
  });

  it("logs a failed release without the rows it could not free", async () => {
    const { dependencies, sendBatch } = setup([
      PENDING,
      { data: claimed(1) },
      { error: { message: "violates constraint for shopper0@example.com" } },
    ]);
    sendBatch.mockResolvedValueOnce({ ok: false, reason: "network" });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(errorLog).toHaveBeenCalledWith("[newsletter] launch_release_failed", {
      reason: "storage_error",
      operation: "launch_release",
    });
  });

  it("never writes an email address to the logs", async () => {
    const { dependencies, sendBatch } = setup([
      PENDING,
      { data: claimed(3) },
      { error: { message: "duplicate shopper1@example.com" } },
    ]);
    sendBatch.mockResolvedValueOnce({ ok: false, reason: "rejected" });

    await dispatchLaunchNotices(PRODUCT_ID, dependencies);

    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/@example\.com/);
  });
});
