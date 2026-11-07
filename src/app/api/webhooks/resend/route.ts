import { handleResendWebhook } from "@/modules/newsletter";

// Node runtime (the default): the Supabase client is not Edge-targeted.
// Resend authenticates by signature, not by the access-gate cookie, so this
// stays reachable because `api/` is excluded from the proxy matcher.
export function POST(request: Request): Promise<Response> {
  return handleResendWebhook(request);
}
