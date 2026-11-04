import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionSource = "newsletter" | "product_launch" | "restock";

export type SubscribeResult = {
  status: "created" | "resubscribed" | "already-active";
  /** The row id, which doubles as the person's unsubscribe token. */
  id: string;
};

const UNIQUE_VIOLATION = "23505";

/**
 * Carries only which step failed. A Supabase error message can echo the row it
 * rejected, and rows here are email addresses, so it is never copied onto the
 * thrown error — the service logs this name and nothing else.
 */
export class NewsletterStorageError extends Error {
  constructor(readonly operation: string) {
    super(`Newsletter storage failed during ${operation}.`);
    this.name = "NewsletterStorageError";
  }
}

type SubscriberRow = { id: string; unsubscribed_at: string | null };

async function findSubscriber(client: SupabaseClient, email: string): Promise<SubscriberRow | null> {
  const { data, error } = await client
    .from("newsletter_subscribers")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new NewsletterStorageError("subscriber_lookup");
  return (data as SubscriberRow | null) ?? null;
}

/**
 * Idempotent by address: the unique `email` column (citext) is the arbiter, so
 * two concurrent signups can never create two rows.
 */
export async function subscribe(
  client: SupabaseClient,
  input: { email: string; source: SubscriptionSource },
): Promise<SubscribeResult> {
  const existing = await findSubscriber(client, input.email);
  if (existing) return reactivateIfNeeded(client, existing, input.source);

  const { data, error } = await client
    .from("newsletter_subscribers")
    .insert({ email: input.email, source: input.source })
    .select("id")
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    // Another request inserted the same address between our lookup and insert.
    // Its row is the truth now; re-reading beats surfacing a failure for what
    // is, from the shopper's side, a successful signup.
    const winner = await findSubscriber(client, input.email);
    if (!winner) throw new NewsletterStorageError("subscriber_race_reread");
    return reactivateIfNeeded(client, winner, input.source);
  }
  if (error || !data) throw new NewsletterStorageError("subscriber_insert");

  return { status: "created", id: (data as { id: string }).id };
}

async function reactivateIfNeeded(
  client: SupabaseClient,
  row: SubscriberRow,
  source: SubscriptionSource,
): Promise<SubscribeResult> {
  if (!row.unsubscribed_at) return { status: "already-active", id: row.id };

  // `source` is overwritten on purpose (Ley 25.326): the person has just given
  // consent again through this form, and the column is the evidence of where
  // the current consent came from, not where the row was first created.
  const { error } = await client
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: null, source })
    .eq("id", row.id);
  if (error) throw new NewsletterStorageError("subscriber_reactivate");

  return { status: "resubscribed", id: row.id };
}

/**
 * A duplicate is a success, not a failure: the partial unique index on
 * (email, variant_id) where notified_at is null means a second request for the
 * same sold-out variant is already covered by the pending one.
 */
export async function requestRestock(
  client: SupabaseClient,
  input: { email: string; productId: number; variantId: number },
): Promise<"created" | "already-requested"> {
  const { error } = await client.from("restock_requests").insert({
    email: input.email,
    product_id: input.productId,
    variant_id: input.variantId,
  });
  if (error?.code === UNIQUE_VIOLATION) return "already-requested";
  if (error) throw new NewsletterStorageError("restock_insert");
  return "created";
}

// Loose on version and variant bits on purpose: this only has to stop obvious
// junk from becoming a query, and the table's own uuid column is the real judge.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TokenResult = "done" | "invalid";

/**
 * The token IS the row id, so possession of the link is the whole credential:
 * it is a v4 uuid (122 random bits) that only ever travelled to its owner's
 * inbox. Not a uuid -> invalid without asking the database anything.
 */
export async function unsubscribe(
  client: SupabaseClient,
  token: string,
  now: () => Date = () => new Date(),
): Promise<TokenResult> {
  if (!UUID_PATTERN.test(token)) return "invalid";

  const { data, error } = await client
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: now().toISOString() })
    .eq("id", token)
    // Keeps the ORIGINAL unsubscribe time on a repeat click instead of
    // rewriting it, so the column stays evidence of when consent was withdrawn.
    .is("unsubscribed_at", null)
    .select("id");
  if (error) throw new NewsletterStorageError("unsubscribe_update");
  if (Array.isArray(data) && data.length > 0) return "done";

  // Nothing was updated: either the address was already out (a double click, a
  // scanner that ran first) — which is still the outcome the person asked for —
  // or the id never existed.
  const existing = await client.from("newsletter_subscribers").select("id").eq("id", token).maybeSingle();
  if (existing.error) throw new NewsletterStorageError("unsubscribe_lookup");
  return existing.data ? "done" : "invalid";
}

/**
 * Undoes an unsubscribe from the same token link. Restoring consent here is
 * sound because the person themselves just asked for it from their own link;
 * `source` is kept since the original opt-in channel has not changed.
 */
export async function resubscribe(client: SupabaseClient, token: string): Promise<TokenResult> {
  if (!UUID_PATTERN.test(token)) return "invalid";

  const { data, error } = await client
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: null })
    .eq("id", token)
    .select("id");
  if (error) throw new NewsletterStorageError("resubscribe_update");
  return Array.isArray(data) && data.length > 0 ? "done" : "invalid";
}

/**
 * Drops a dead address from every table that could still mail it. The
 * subscriber row is DELETED rather than flagged `unsubscribed_at`: that column
 * is consent-withdrawal evidence (Ley 25.326) and a bounce is not a withdrawal.
 *
 * Only PENDING requests go: a notified row is history of something we already
 * sent, and nothing will ever mail it again.
 *
 * Deleting an absent row is success, since Resend retries a delivery until it
 * gets a 2xx and the second attempt finds nothing left to do. Each step has its
 * own operation name so a partial failure says which table still holds the
 * address.
 */
export async function forgetAddress(client: SupabaseClient, email: string): Promise<void> {
  const subscriber = await client.from("newsletter_subscribers").delete().eq("email", email);
  if (subscriber.error) throw new NewsletterStorageError("forget_subscriber");

  const restock = await client.from("restock_requests").delete().eq("email", email).is("notified_at", null);
  if (restock.error) throw new NewsletterStorageError("forget_restock_requests");

  const launch = await client.from("product_launch_requests").delete().eq("email", email).is("notified_at", null);
  if (launch.error) throw new NewsletterStorageError("forget_launch_requests");
}
