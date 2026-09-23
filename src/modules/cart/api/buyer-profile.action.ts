"use server";

import type { BuyerProfileSummary } from "./port";
import { readBuyerProfileSummary } from "./buyer-profile.service";
import { isAccessGranted } from "@/modules/access-gate/api/access-guard";

/** Public read boundary: implementation and cookie access remain server-only. */
export async function readBuyerProfile(): Promise<BuyerProfileSummary> {
  // The gate lives in the proxy, which does not cover this POST path — an
  // ungated caller gets the same "no profile" shape a shopper with no
  // profile sees, rather than a signal that a gate exists at all.
  if (!(await isAccessGranted())) {
    return { hasProfile: false, maskedLabel: null };
  }

  return readBuyerProfileSummary();
}
