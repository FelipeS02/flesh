"use server";

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { subscribeToNewsletter as subscribe, type SubscribeOutcome } from "./newsletter.service";

/** Public mutation boundary; the service and its credentials stay server-only. */
export async function subscribeToNewsletter(input: unknown): Promise<SubscribeOutcome> {
  // Server Actions are dispatched by id, so the proxy gate does not cover them
  // (see `isAccessGranted`). Refused with the same generic result every other
  // failure returns, so an ungated caller learns nothing.
  if (!(await isAccessGranted())) return { ok: false, error: "unavailable" };
  return subscribe(input);
}
