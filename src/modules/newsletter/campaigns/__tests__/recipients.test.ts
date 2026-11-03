import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "../../api/__tests__/fake-supabase";
import { activeSubscriberPages, countActiveSubscribers } from "../recipients";

const row = (id: string) => ({ id, email: `${id}@example.com` });

describe("countActiveSubscribers", () => {
  it("counts only subscribers who have not unsubscribed, without fetching rows", async () => {
    const { client, calls } = createFakeSupabase([{ count: 42 }]);

    await expect(countActiveSubscribers(client)).resolves.toBe(42);
    expect(calls[0]!.table).toBe("newsletter_subscribers");
    expect(calls[0]!.ops).toEqual([
      ["select", "id", { count: "exact", head: true }],
      ["is", "unsubscribed_at", null],
    ]);
  });

  it("fails loudly instead of reporting zero when the query errors", async () => {
    const { client } = createFakeSupabase([{ error: { message: "down" } }]);

    await expect(countActiveSubscribers(client)).rejects.toThrow(/subscriber_count/);
  });
});

describe("activeSubscriberPages", () => {
  async function collect(source: AsyncIterable<unknown[]>) {
    const pages: unknown[][] = [];
    for await (const page of source) pages.push(page);
    return pages;
  }

  it("pages by id after the last one seen, stopping on a short page", async () => {
    const { client, calls } = createFakeSupabase([{ data: [row("a"), row("b")] }, { data: [row("c")] }]);

    const pages = await collect(activeSubscriberPages(client, 2));

    expect(pages).toEqual([[row("a"), row("b")], [row("c")]]);
    expect(calls[0]!.ops).toEqual([
      ["select", "id, email"],
      ["is", "unsubscribed_at", null],
      ["order", "id", { ascending: true }],
      ["limit", 2],
    ]);
    expect(calls[1]!.ops).toContainEqual(["gt", "id", "b"]);
    expect(calls).toHaveLength(2);
  });

  // Keyset rather than offset: someone unsubscribing mid-run must not shift
  // every later page and skip a person.
  it("asks once more when a page is exactly full, and ends on the empty one", async () => {
    const { client, calls } = createFakeSupabase([{ data: [row("a"), row("b")] }, { data: [] }]);

    const pages = await collect(activeSubscriberPages(client, 2));

    expect(pages).toEqual([[row("a"), row("b")]]);
    expect(calls).toHaveLength(2);
  });

  it("throws on a storage error rather than ending the list quietly", async () => {
    const { client } = createFakeSupabase([{ error: { message: "down" } }]);

    await expect(collect(activeSubscriberPages(client, 2))).rejects.toThrow(/subscriber_page/);
  });
});
