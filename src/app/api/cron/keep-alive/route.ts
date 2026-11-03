import { handleKeepAlive } from "@/modules/newsletter";

/**
 * Target of the daily Vercel Cron in `vercel.json`. Reading the request's
 * headers already makes this handler run per request, so no route config is
 * needed to keep it from being cached.
 */
export function GET(request: Request): Promise<Response> {
  return handleKeepAlive(request);
}
