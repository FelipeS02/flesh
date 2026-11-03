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
