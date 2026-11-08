import { describe, expect, it } from "vitest";
import { claimLaunches, hasPendingLaunch, releaseLaunches, requestLaunch } from "../launch-requests";
import { createFakeSupabase } from "./fake-supabase";

const UNIQUE_VIOLATION = { code: "23505", message: "duplicate key value" };

describe("requestLaunch", () => {
  const request = { email: "ana@example.com", productId: 50 };

  it("stores a pending request and reports it created", async () => {
    const { client, calls } = createFakeSupabase([{ data: null }]);

    await expect(requestLaunch(client, request)).resolves.toBe("created");
    expect(calls).toEqual([
      {
        table: "product_launch_requests",
        ops: [["insert", { email: "ana@example.com", product_id: 50 }]],
      },
    ]);
  });

  it("treats the partial unique index violation as already-requested", async () => {
    const { client } = createFakeSupabase([{ error: UNIQUE_VIOLATION }]);

    await expect(requestLaunch(client, request)).resolves.toBe("already-requested");
  });

  it("throws a storage error naming the step, never the address, on any other failure", async () => {
    const { client } = createFakeSupabase([{ error: { code: "XX000", message: "ana@example.com" } }]);

    const failure = await requestLaunch(client, request).catch((error: unknown) => error);
    expect((failure as Error).name).toBe("NewsletterStorageError");
    expect((failure as Error).message).not.toContain("ana@example.com");
  });
});

describe("hasPendingLaunch", () => {
  it("looks for one pending row of the product, served by the partial index", async () => {
    const { client, calls } = createFakeSupabase([{ data: [{ id: "a" }] }]);

    await expect(hasPendingLaunch(client, 50)).resolves.toBe(true);
    expect(calls).toEqual([
      {
        table: "product_launch_requests",
        ops: [["select", "id"], ["eq", "product_id", 50], ["is", "notified_at", null], ["limit", 1]],
      },
    ]);
  });

  it("is false when nobody is waiting", async () => {
    const { client } = createFakeSupabase([{ data: [] }]);

    await expect(hasPendingLaunch(client, 50)).resolves.toBe(false);
  });

  it("throws a storage error naming the lookup", async () => {
    const { client } = createFakeSupabase([{ error: { message: "db down" } }]);

    const failure = await hasPendingLaunch(client, 50).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: "NewsletterStorageError", operation: "launch_pending_lookup" });
  });
});

describe("claimLaunches", () => {
  const input = { productId: 50, now: new Date("2026-11-03T12:00:00.000Z") };

  // The `notified_at is null` guard is the arbiter: a duplicate webhook matches nothing.
  it("flips only pending rows and returns exactly the ones it flipped", async () => {
    const { client, calls } = createFakeSupabase([{ data: [{ id: "a", email: "ana@example.com" }] }]);

    await expect(claimLaunches(client, input)).resolves.toEqual([{ id: "a", email: "ana@example.com" }]);
    expect(calls[0]!.ops).toEqual([
      ["update", { notified_at: "2026-11-03T12:00:00.000Z" }],
      ["eq", "product_id", 50],
      ["is", "notified_at", null],
      ["select", "id, email"],
    ]);
  });

  it("returns an empty list when another delivery already claimed them", async () => {
    const { client } = createFakeSupabase([{ data: [] }]);

    await expect(claimLaunches(client, input)).resolves.toEqual([]);
  });

  it("throws a storage error naming the claim, never the address", async () => {
    const { client } = createFakeSupabase([{ error: { message: "ana@example.com" } }]);

    const failure = await claimLaunches(client, input).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: "NewsletterStorageError", operation: "launch_claim" });
    expect((failure as Error).message).not.toContain("ana@example.com");
  });
});

describe("releaseLaunches", () => {
  it("puts the given rows back to pending", async () => {
    const { client, calls } = createFakeSupabase([{ data: null }]);

    await releaseLaunches(client, ["a", "b"]);

    expect(calls[0]!.ops).toEqual([["update", { notified_at: null }], ["in", "id", ["a", "b"]]]);
  });

  it("throws a storage error naming the release", async () => {
    const { client } = createFakeSupabase([{ error: { message: "db down" } }]);

    const failure = await releaseLaunches(client, ["a"]).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: "NewsletterStorageError", operation: "launch_release" });
  });
});
