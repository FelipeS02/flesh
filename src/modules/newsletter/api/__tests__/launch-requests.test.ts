import { describe, expect, it } from "vitest";
import { requestLaunch } from "../launch-requests";
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
