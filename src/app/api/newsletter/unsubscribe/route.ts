import { handleUnsubscribe } from "@/modules/newsletter";

// Node runtime (the default): the Supabase client is not Edge-targeted.
// Target of the `List-Unsubscribe-Post` header, so it must stay reachable
// without the access-gate cookie — `api/` is excluded from the proxy matcher.
export function POST(request: Request): Promise<Response> {
  return handleUnsubscribe(request);
}
