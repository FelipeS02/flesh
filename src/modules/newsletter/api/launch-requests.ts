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
