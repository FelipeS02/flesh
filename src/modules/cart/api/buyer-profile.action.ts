"use server";

import type { BuyerProfileSummary } from "./port";
import { readBuyerProfileSummary } from "./buyer-profile.service";

/** Public read boundary: implementation and cookie access remain server-only. */
export async function readBuyerProfile(): Promise<BuyerProfileSummary> {
  return readBuyerProfileSummary();
}
