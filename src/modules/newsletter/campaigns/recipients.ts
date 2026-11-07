import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsletterStorageError } from "../api/subscribers";
import type { Recipient } from "./messages";

export const PAGE_SIZE = 1000;

/** Active means never unsubscribed, or resubscribed since. */
export async function countActiveSubscribers(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .is("unsubscribed_at", null);
  // A failed count must not read as an empty list: the run would "succeed" and send nothing.
  if (error || count === null) throw new NewsletterStorageError("subscriber_count");
  return count;
}

/**
 * Streams active subscribers in id order, a page at a time.
 *
 * Keyset (`id > last`) rather than offset: a person unsubscribing mid-run would
 * shift every later offset page and silently skip the next subscriber.
 */
export async function* activeSubscriberPages(
  client: SupabaseClient,
  pageSize: number = PAGE_SIZE,
): AsyncGenerator<Recipient[]> {
  let lastId: string | null = null;
  for (;;) {
    let query = client.from("newsletter_subscribers").select("id, email").is("unsubscribed_at", null);
    if (lastId !== null) query = query.gt("id", lastId);
    const { data, error } = await query.order("id", { ascending: true }).limit(pageSize);
    if (error) throw new NewsletterStorageError("subscriber_page");

    const page = (data ?? []) as Recipient[];
    if (page.length === 0) return;
    yield page;
    if (page.length < pageSize) return;
    lastId = page[page.length - 1]!.id;
  }
}
