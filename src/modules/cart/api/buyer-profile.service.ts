import "server-only";
import { headers } from "next/headers";
import { readClientKey } from "@/lib/client-key";
import { BuyerSchema } from "./checkout.service";
import { createCheckoutRateGuard, type CheckoutRateGuard } from "./checkout.guard";
import { readBuyerCookie } from "./buyer-profile.cookie";
import { maskBuyerLabel } from "./buyer-profile.mask";
import type { BuyerProfileSummary } from "./port";

type Dependencies = { readBuyer: () => Promise<unknown>; guard: CheckoutRateGuard; readClientKey: () => Promise<string> };

// A guard of its own (design D7) — sharing `checkout.service`'s instance
// would let opening the drawer repeatedly exhaust the shopper's checkout
// budget before they ever submit. Keyed per client for the same reason
// `checkout.guard.ts` is: one client polling this endpoint must not exhaust
// the profile read for every other shopper.
const defaultGuard = createCheckoutRateGuard();
async function defaultReadClientKey(): Promise<string> {
  return readClientKey(await headers());
}
function defaultDependencies(): Dependencies {
  return { readBuyer: readBuyerCookie, guard: defaultGuard, readClientKey: defaultReadClientKey };
}

/**
 * Never returns a raw name/surname/email — only `{hasProfile, maskedLabel}`
 * reaches the client (spec "No unmasked leak"). Fails closed to
 * `{hasProfile: false, maskedLabel: null}` on a tampered stored value or on
 * its own guard refusing, exactly like the "no cookie" case — this endpoint
 * has nothing safe to say beyond "show the form".
 */
export async function readBuyerProfileSummary(dependencies?: Dependencies): Promise<BuyerProfileSummary> {
  const resolved = dependencies ?? defaultDependencies();
  const absent: BuyerProfileSummary = { hasProfile: false, maskedLabel: null };
  const clientKey = await resolved.readClientKey();
  if (!resolved.guard.consume(clientKey)) return absent;
  const stored = await resolved.readBuyer();
  const parsed = BuyerSchema.safeParse(stored);
  if (!parsed.success) return absent;
  return { hasProfile: true, maskedLabel: maskBuyerLabel(parsed.data) };
}
