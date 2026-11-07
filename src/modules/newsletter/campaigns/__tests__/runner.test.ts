import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailResult } from "../../api/mailer";
import type { CampaignTemplate } from "../messages";
import { sendCampaign } from "../runner";

const ORIGIN = "https://flesh.test";
const template: CampaignTemplate = { default: () => null, subject: "Nuevo drop", previewText: "x" };

const recipient = (n: number) => ({ id: `id-${n}`, email: `shopper${n}@example.com` });
async function* batches(...sizes: number[]) {
  let n = 0;
  for (const size of sizes) yield Array.from({ length: size }, () => recipient(n++));
}

function setup(results: MailResult[] = []) {
  const sendBatch = vi.fn(async (): Promise<MailResult> => results.shift() ?? { ok: true, ids: [] });
  const sleep = vi.fn(async () => {});
  const log = vi.fn();
  return { sendBatch, sleep, log, mailer: { send: vi.fn(), sendBatch } };
}

const run = (s: ReturnType<typeof setup>, source: AsyncIterable<ReturnType<typeof recipient>[]>, fromBatch = 0) =>
  sendCampaign({ slug: "drop", template, origin: ORIGIN, batches: source, mailer: s.mailer, fromBatch, sleep: s.sleep, log: s.log });

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("sendCampaign", () => {
  it("sends every batch under its own deterministic idempotency key", async () => {
    const s = setup();

    const summary = await run(s, batches(100, 100, 3));

    expect(summary).toEqual({ ok: true, batches: 3, recipients: 203 });
    expect(s.sendBatch.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      { idempotencyKey: "campaign/drop/0" },
      { idempotencyKey: "campaign/drop/1" },
      { idempotencyKey: "campaign/drop/2" },
    ]);
    const first = (s.sendBatch.mock.calls[0] as unknown[])[0] as { to: string; headers: Record<string, string> }[];
    expect(first[1]!.to).toBe("shopper1@example.com");
    expect(first[1]!.headers["List-Unsubscribe"]).toContain("id-1");
  });

  it("paces sequential sends instead of bursting past the provider limit", async () => {
    const s = setup();

    await run(s, batches(100, 100, 100));

    expect(s.sleep.mock.calls).toEqual([[500], [500]]);
  });

  it("skips batches before --from-batch without sending or waiting", async () => {
    const s = setup();

    const summary = await run(s, batches(100, 100, 100), 2);

    expect(summary).toEqual({ ok: true, batches: 1, recipients: 100 });
    expect(s.sendBatch).toHaveBeenCalledTimes(1);
    expect((s.sendBatch.mock.calls[0] as unknown[])[1]).toEqual({ idempotencyKey: "campaign/drop/2" });
    expect(s.sleep).not.toHaveBeenCalled();
  });

  it("retries a rate limit with the same key, backing off", async () => {
    const s = setup([{ ok: false, reason: "rate-limited" }, { ok: false, reason: "network" }]);

    const summary = await run(s, batches(10));

    expect(summary).toMatchObject({ ok: true });
    expect(s.sendBatch).toHaveBeenCalledTimes(3);
    expect(new Set(s.sendBatch.mock.calls.map((call) => (call as unknown[])[1] as unknown as string).map((o) => JSON.stringify(o))).size).toBe(1);
    expect(s.sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  it("stops at the first batch the provider rejects and says where to resume", async () => {
    const s = setup([{ ok: true, ids: [] }, { ok: false, reason: "rejected" }]);

    const summary = await run(s, batches(100, 100, 100));

    expect(summary).toEqual({ ok: false, failedBatch: 1, reason: "rejected", sentBatches: 1 });
    expect(s.sendBatch).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retries are spent", async () => {
    const s = setup(Array.from({ length: 5 }, () => ({ ok: false as const, reason: "rate-limited" as const })));

    const summary = await run(s, batches(10, 10));

    expect(summary).toEqual({ ok: false, failedBatch: 0, reason: "rate-limited", sentBatches: 0 });
    expect(s.sendBatch).toHaveBeenCalledTimes(4);
  });

  it("treats a thrown mailer as a failed batch, never as success", async () => {
    const s = setup();
    s.sendBatch.mockRejectedValueOnce(new Error("boom shopper0@example.com"));

    const summary = await run(s, batches(10));

    expect(summary).toMatchObject({ ok: false, failedBatch: 0, reason: "unexpected_error" });
  });

  it("never logs an email address", async () => {
    const s = setup([{ ok: false, reason: "rejected" }]);

    await run(s, batches(3));

    expect(JSON.stringify([s.log.mock.calls, vi.mocked(console.error).mock.calls])).not.toMatch(/@example\.com/);
  });
});
