import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";

/**
 * The secret key bypasses RLS, which is exactly what the policy-less tables
 * need — and exactly why this file is `server-only`: a client bundle that
 * reached it would ship a key with full table access.
 */
export function createSupabaseServerClient(
  environment: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const { url, secretKey } = readSupabaseConfig(environment);
  return createClient(url, secretKey, {
    // There is no user session on the server; persisting or refreshing one
    // would only hold timers and storage open inside a serverless invocation.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
