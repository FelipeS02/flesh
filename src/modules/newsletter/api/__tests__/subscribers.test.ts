import { describe, expect, it } from "vitest";
import { requestRestock, subscribe } from "../subscribers";
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
