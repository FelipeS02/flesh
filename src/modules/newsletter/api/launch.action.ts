"use server";

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { requestLaunchNotice as request, type LaunchOutcome } from "./newsletter.service";

/** Public mutation boundary; see `subscribe.action.ts` for why the gate is re-checked here. */
export async function requestLaunchNotice(input: unknown): Promise<LaunchOutcome> {
  if (!(await isAccessGranted())) return { ok: false, error: "unavailable" };
  return request(input);
}
