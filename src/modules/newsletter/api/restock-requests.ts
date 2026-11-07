import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsletterStorageError } from "./subscribers";

export type ClaimedRestock = { id: string; email: string; variantId: number };

/**
 * Cheap gate in front of the Tiendanube call: every product edit fires the
 * webhook, and almost none of them have anyone waiting. Served by the partial
 * index on (product_id) where notified_at is null.
 */
export async function hasPendingRestock(client: SupabaseClient, productId: number): Promise<boolean> {
  const { data, error } = await client
    .from("restock_requests")
    .select("id")
    .eq("product_id", productId)
    .is("notified_at", null)
    .limit(1);
  if (error) throw new NewsletterStorageError("restock_pending_lookup");
  return Array.isArray(data) && data.length > 0;
}

/**
 * Marks the pending rows of these variants as notified and returns exactly the
 * rows THIS call flipped. The `notified_at is null` guard makes the update the
 * arbiter: a duplicate or concurrent webhook matches nothing and therefore
 * sends nothing, which a read-then-send could not promise.
 */
export async function claimRestocks(
  client: SupabaseClient,
  input: { productId: number; variantIds: number[]; now: Date },
): Promise<ClaimedRestock[]> {
  const { data, error } = await client
    .from("restock_requests")
    .update({ notified_at: input.now.toISOString() })
    .eq("product_id", input.productId)
    .in("variant_id", input.variantIds)
    .is("notified_at", null)
    .select("id, email, variant_id");
  if (error) throw new NewsletterStorageError("restock_claim");
  return ((data ?? []) as { id: string; email: string; variant_id: number }[]).map((row) => ({
    id: row.id,
    email: row.email,
    variantId: row.variant_id,
  }));
}

/** Puts claimed rows back to pending so the next restock event retries them. */
export async function releaseRestocks(client: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await client.from("restock_requests").update({ notified_at: null }).in("id", ids);
  if (error) throw new NewsletterStorageError("restock_release");
}
