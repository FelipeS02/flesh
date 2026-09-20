import "server-only";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { CLICK_ID_COOKIE_NAME, PIXEL_COOKIE_NAME } from "./browser-ids";
import { createCapiSender, readCapiConfig } from "./capi";
import {
  toInitiateCheckoutEvent,
  type CheckoutLine,
} from "./initiate-checkout";

type Input = {
  buyer: { firstName: string; lastName: string; email: string };
  lines: CheckoutLine[];
};

/**
 * Reports the checkout handoff to Meta, from the server, without the shopper
 * waiting for it.
 *
 * `after` is the whole reason this is safe to call inside the checkout: the
 * callback runs once the response has already been sent, so a slow or
 * unreachable Meta costs the buyer nothing. The cookies and headers are read
 * BEFORE scheduling, while the request is still the current one.
 *
 * Nothing here can fail loudly. The sender never throws by construction, and
 * the builder can (empty or mixed-currency lines), so the whole assembly is
 * guarded: a measurement must never be the reason a checkout does not happen.
 */
export async function reportCheckoutStarted(input: Input): Promise<void> {
  try {
    const config = readCapiConfig();
    if (!config) return;

    const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

    const event = toInitiateCheckoutEvent({
      buyer: input.buyer,
      lines: input.lines,
      nowMs: Date.now(),
      sourceUrl: headerList.get("referer") ?? undefined,
      fbc: cookieStore.get(CLICK_ID_COOKIE_NAME)?.value ?? null,
      fbp: cookieStore.get(PIXEL_COOKIE_NAME)?.value ?? null,
      // First hop only: the rest of the chain is whatever each proxy chose to
      // append, and Meta wants the client, not the infrastructure.
      clientIpAddress:
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      clientUserAgent: headerList.get("user-agent"),
    });

    const send = createCapiSender(config);
    after(() => send(event));
  } catch {
    // Deliberately silent, for the same reason the sender is: there is no
    // recovery, and the checkout must continue regardless.
  }
}
