import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsletterStorageError, UNIQUE_VIOLATION } from "./subscribers";

/**
 * A duplicate is a success, not a failure: the partial unique index on
 * (email, product_id) where notified_at is null means a second request for the
 * same unreleased product is already covered by the pending one.
 */
export async function requestLaunch(
  client: SupabaseClient,
  input: { email: string; productId: number },
): Promise<"created" | "already-requested"> {
  const { error } = await client.from("product_launch_requests").insert({
    email: input.email,
    product_id: input.productId,
  });
  if (error?.code === UNIQUE_VIOLATION) return "already-requested";
  if (error) throw new NewsletterStorageError("launch_insert");
  return "created";
}

export type ClaimedLaunch = { id: string; email: string };

/**
 * Cheap gate in front of the Tiendanube calls: every product edit fires the
 * webhook, and almost none of them have anyone waiting. Served by the partial
 * index on (product_id) where notified_at is null.
 */
export async function hasPendingLaunch(client: SupabaseClient, productId: number): Promise<boolean> {
  const { data, error } = await client
    .from("product_launch_requests")
    .select("id")
    .eq("product_id", productId)
    .is("notified_at", null)
    .limit(1);
  if (error) throw new NewsletterStorageError("launch_pending_lookup");
  return Array.isArray(data) && data.length > 0;
}

/**
 * Marks the pending rows of this product as notified and returns exactly the
 * rows THIS call flipped. The `notified_at is null` guard makes the update the
 * arbiter: a duplicate or concurrent webhook matches nothing and therefore
 * sends nothing, which a read-then-send could not promise.
 */
export async function claimLaunches(
  client: SupabaseClient,
  input: { productId: number; now: Date },
): Promise<ClaimedLaunch[]> {
  const { data, error } = await client
    .from("product_launch_requests")
    .update({ notified_at: input.now.toISOString() })
    .eq("product_id", input.productId)
    .is("notified_at", null)
    .select("id, email");
  if (error) throw new NewsletterStorageError("launch_claim");
  return ((data ?? []) as { id: string; email: string }[]).map((row) => ({ id: row.id, email: row.email }));
}

/** Puts claimed rows back to pending so the next product update retries them. */
export async function releaseLaunches(client: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await client.from("product_launch_requests").update({ notified_at: null }).in("id", ids);
  if (error) throw new NewsletterStorageError("launch_release");
}
