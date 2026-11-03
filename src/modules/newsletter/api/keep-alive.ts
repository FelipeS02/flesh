import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase";

export type KeepAliveDependencies = {
  cronSecret: string | undefined;
  createClient: () => SupabaseClient;
};

function defaultDependencies(): KeepAliveDependencies {
  return {
    cronSecret: process.env.CRON_SECRET,
    createClient: () => createSupabaseServerClient(),
  };
}

function isAuthorized(request: Request, cronSecret: string | undefined): boolean {
  // Fail closed: with no secret configured, `Bearer undefined` would otherwise
  // match a naive string comparison and open the endpoint to anyone.
  if (!cronSecret) return false;

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  // timingSafeEqual throws on unequal lengths, so a mismatch is rejected first.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Daily Vercel Cron target. The free Supabase plan pauses a project after
 * ~7 days without queries and restoring it is not instant, so one cheap read
 * a day prevents the outage instead of recovering from it.
 */
export async function handleKeepAlive(
  request: Request,
  dependencies: KeepAliveDependencies = defaultDependencies(),
): Promise<Response> {
  if (!isAuthorized(request, dependencies.cronSecret)) {
    return new Response(null, { status: 401 });
  }

  try {
    const { error } = await dependencies
      .createClient()
      .from("newsletter_subscribers")
      .select("id")
      .limit(1);
    // A non-2xx is the point: it is what makes a failed ping visible in
    // Vercel's cron logs. The body stays empty so no database detail leaks.
    if (error) return new Response(null, { status: 503 });
  } catch {
    return new Response(null, { status: 503 });
  }

  return new Response(null, { status: 204 });
}
