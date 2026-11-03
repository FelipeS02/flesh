"use server";

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { requestRestockNotice as request, type RestockOutcome } from "./newsletter.service";

/** Public mutation boundary; see `subscribe.action.ts` for why the gate is re-checked here. */
export async function requestRestockNotice(input: unknown): Promise<RestockOutcome> {
  if (!(await isAccessGranted())) return { ok: false, error: "unavailable" };
  return request(input);
}
