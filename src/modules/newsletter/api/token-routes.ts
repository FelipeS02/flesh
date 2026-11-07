import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase";
import { resubscribe, unsubscribe, type TokenResult } from "./subscribers";

export type TokenRouteDependencies = {
  createClient: () => SupabaseClient;
  repository: {
    unsubscribe: (client: SupabaseClient, token: string) => Promise<TokenResult>;
    resubscribe: (client: SupabaseClient, token: string) => Promise<TokenResult>;
  };
};

function defaultDependencies(): TokenRouteDependencies {
  return {
    createClient: () => createSupabaseServerClient(),
    repository: { unsubscribe, resubscribe },
  };
}

async function handleTokenAction(
  request: Request,
  operation: "unsubscribe" | "resubscribe",
  dependencies: TokenRouteDependencies,
): Promise<Response> {
  // Read from the query string only. RFC 8058 sends `List-Unsubscribe=One-Click`
  // as the body, but mail clients vary and the token is already in the URL, so
  // the body is neither required nor read.
  const token = new URL(request.url).searchParams.get("token") ?? "";

  try {
    const result = await dependencies.repository[operation](dependencies.createClient(), token);
    return new Response(null, { status: result === "done" ? 204 : 404 });
  } catch (error) {
    // Only the operation and the error's class: the token is a credential and
    // a thrown message could echo the row it belongs to.
    console.error(`[newsletter] ${operation} failed`, { errorName: error instanceof Error ? error.name : "unknown" });
    // A non-2xx is what lets a mail client retry and what makes the failure
    // visible in the logs; the body stays empty so nothing leaks.
    return new Response(null, { status: 503 });
  }
}

/**
 * RFC 8058 one-click target and the endpoint the /newsletter/baja page calls.
 * POST-only at the route: a GET would be fired by every link scanner.
 */
export function handleUnsubscribe(
  request: Request,
  dependencies: TokenRouteDependencies = defaultDependencies(),
): Promise<Response> {
  return handleTokenAction(request, "unsubscribe", dependencies);
}

export function handleResubscribe(
  request: Request,
  dependencies: TokenRouteDependencies = defaultDependencies(),
): Promise<Response> {
  return handleTokenAction(request, "resubscribe", dependencies);
}
