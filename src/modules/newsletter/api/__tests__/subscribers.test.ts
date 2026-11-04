import { describe, expect, it } from "vitest";
import { forgetAddress, requestRestock, resubscribe, subscribe, unsubscribe } from "../subscribers";
import { createFakeSupabase } from "./fake-supabase";

const ID = "7b1d6f0e-2c1a-4a58-9d3e-5a1f0c2b9e11";
const UNIQUE_VIOLATION = { code: "23505", message: "duplicate key value" };

describe("subscribe", () => {
  it("inserts a new address and reports it created", async () => {
    const { client, calls } = createFakeSupabase([
      { data: null }, // lookup: unknown address
      { data: { id: ID } }, // insert ... returning id
    ]);

    await expect(subscribe(client, { email: "ana@example.com", source: "newsletter" })).resolves.toEqual({
      status: "created",
      id: ID,
    });
    expect(calls[1]).toEqual({
      table: "newsletter_subscribers",
      ops: [
        ["insert", { email: "ana@example.com", source: "newsletter" }],
        ["select", "id"],
        ["single"],
      ],
    });
  });

  it("reports an active address as already-active without writing", async () => {
    const { client, calls } = createFakeSupabase([{ data: { id: ID, unsubscribed_at: null } }]);

    await expect(subscribe(client, { email: "ana@example.com", source: "newsletter" })).resolves.toEqual({
      status: "already-active",
      id: ID,
    });
    expect(calls).toHaveLength(1);
  });

  it("reactivates an unsubscribed address and records the new source as fresh consent", async () => {
    const { client, calls } = createFakeSupabase([
      { data: { id: ID, unsubscribed_at: "2026-10-01T00:00:00Z" } },
      { data: null },
    ]);

    await expect(subscribe(client, { email: "ana@example.com", source: "restock" })).resolves.toEqual({
      status: "resubscribed",
      id: ID,
    });
    expect(calls[1]).toEqual({
      table: "newsletter_subscribers",
      ops: [
        ["update", { unsubscribed_at: null, source: "restock" }],
        ["eq", "id", ID],
      ],
    });
  });

  it("re-reads after losing the insert race and treats the winner's row as already-active", async () => {
    const { client, calls } = createFakeSupabase([
      { data: null },
      { error: UNIQUE_VIOLATION },
      { data: { id: ID, unsubscribed_at: null } },
    ]);

    await expect(subscribe(client, { email: "ana@example.com", source: "newsletter" })).resolves.toEqual({
      status: "already-active",
      id: ID,
    });
    expect(calls).toHaveLength(3);
  });

  it("throws a sanitized storage error when the lookup fails", async () => {
    const { client } = createFakeSupabase([{ error: { code: "XX000", message: "ana@example.com leaked" } }]);

    const failure = await subscribe(client, { email: "ana@example.com", source: "newsletter" }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).name).toBe("NewsletterStorageError");
    expect((failure as Error).message).not.toContain("ana@example.com");
  });

  it("throws when the race re-read finds nothing, instead of inventing an id", async () => {
    const { client } = createFakeSupabase([{ data: null }, { error: UNIQUE_VIOLATION }, { data: null }]);

    await expect(subscribe(client, { email: "ana@example.com", source: "newsletter" })).rejects.toThrow();
  });
});

describe("requestRestock", () => {
  const request = { email: "ana@example.com", productId: 10, variantId: 20 };

  it("stores a pending request and reports it created", async () => {
    const { client, calls } = createFakeSupabase([{ data: null }]);

    await expect(requestRestock(client, request)).resolves.toBe("created");
    expect(calls).toEqual([
      {
        table: "restock_requests",
        ops: [["insert", { email: "ana@example.com", product_id: 10, variant_id: 20 }]],
      },
    ]);
  });

  it("treats the partial unique index violation as already-requested", async () => {
    const { client } = createFakeSupabase([{ error: UNIQUE_VIOLATION }]);

    await expect(requestRestock(client, request)).resolves.toBe("already-requested");
  });

  it("throws on any other database error", async () => {
    const { client } = createFakeSupabase([{ error: { code: "XX000" } }]);

    await expect(requestRestock(client, request)).rejects.toThrow();
  });
});

describe("unsubscribe", () => {
  const NOW = new Date("2026-11-03T12:00:00Z");

  it("short-circuits a token that is not a uuid, without any query", async () => {
    const { client, calls } = createFakeSupabase([]);

    await expect(unsubscribe(client, "not-a-uuid")).resolves.toBe("invalid");
    await expect(unsubscribe(client, "")).resolves.toBe("invalid");
    expect(calls).toHaveLength(0);
  });

  it("stamps unsubscribed_at on an active row", async () => {
    const { client, calls } = createFakeSupabase([{ data: [{ id: ID }] }]);

    await expect(unsubscribe(client, ID, () => NOW)).resolves.toBe("done");
    expect(calls).toEqual([
      {
        table: "newsletter_subscribers",
        ops: [
          ["update", { unsubscribed_at: "2026-11-03T12:00:00.000Z" }],
          ["eq", "id", ID],
          ["is", "unsubscribed_at", null],
          ["select", "id"],
        ],
      },
    ]);
  });

  it("is idempotent: an already-unsubscribed row is still done", async () => {
    const { client } = createFakeSupabase([{ data: [] }, { data: { id: ID } }]);

    await expect(unsubscribe(client, ID)).resolves.toBe("done");
  });

  it("reports invalid for an unknown id", async () => {
    const { client } = createFakeSupabase([{ data: [] }, { data: null }]);

    await expect(unsubscribe(client, ID)).resolves.toBe("invalid");
  });

  it("throws on a database error rather than claiming success", async () => {
    const { client } = createFakeSupabase([{ error: { code: "XX000" } }]);

    await expect(unsubscribe(client, ID)).rejects.toThrow();
  });
});

describe("resubscribe", () => {
  it("short-circuits a malformed token without any query", async () => {
    const { client, calls } = createFakeSupabase([]);

    await expect(resubscribe(client, "nope")).resolves.toBe("invalid");
    expect(calls).toHaveLength(0);
  });

  it("clears unsubscribed_at and leaves the source alone", async () => {
    const { client, calls } = createFakeSupabase([{ data: [{ id: ID }] }]);

    await expect(resubscribe(client, ID)).resolves.toBe("done");
    expect(calls[0]?.ops[0]).toEqual(["update", { unsubscribed_at: null }]);
    expect(calls[0]?.ops).toContainEqual(["eq", "id", ID]);
  });

  it("reports invalid for an unknown id", async () => {
    const { client } = createFakeSupabase([{ data: [] }]);

    await expect(resubscribe(client, ID)).resolves.toBe("invalid");
  });

  it("throws on a database error", async () => {
    const { client } = createFakeSupabase([{ error: { code: "XX000" } }]);

    await expect(resubscribe(client, ID)).rejects.toThrow();
  });
});

describe("forgetAddress", () => {
  it("deletes the subscriber and only the pending requests for that address", async () => {
    const { client, calls } = createFakeSupabase([{}, {}, {}]);

    await expect(forgetAddress(client, "dead@example.com")).resolves.toBeUndefined();

    expect(calls).toEqual([
      { table: "newsletter_subscribers", ops: [["delete"], ["eq", "email", "dead@example.com"]] },
      {
        table: "restock_requests",
        ops: [["delete"], ["eq", "email", "dead@example.com"], ["is", "notified_at", null]],
      },
      {
        table: "product_launch_requests",
        ops: [["delete"], ["eq", "email", "dead@example.com"], ["is", "notified_at", null]],
      },
    ]);
  });

  it("succeeds when nothing matched, because Resend retries deliveries", async () => {
    const { client } = createFakeSupabase([{ data: [] }, { data: [] }, { data: [] }]);

    await expect(forgetAddress(client, "gone@example.com")).resolves.toBeUndefined();
  });

  it.each([
    [0, "forget_subscriber"],
    [1, "forget_restock_requests"],
    [2, "forget_launch_requests"],
  ])("names the failing step when delete #%i errors", async (failingStep, operation) => {
    const replies = [{}, {}, {}].map((reply, index) =>
      index === failingStep ? { error: { code: "XX000", message: "dead@example.com" } } : reply,
    );
    const { client } = createFakeSupabase(replies);

    const failure = await forgetAddress(client, "dead@example.com").catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: "NewsletterStorageError", operation });
    expect((failure as Error).message).not.toContain("dead@example.com");
  });
});
