import type { RestockOutcome, SubscribeOutcome } from "../api/newsletter.service";
import { requestRestockNotice } from "../api/restock.action";
import { subscribeToNewsletter } from "../api/subscribe.action";

// Imported from the action files and NOT from `../index`: the index also
// exports server-only modules (mailer, dispatcher, route handlers) that must
// never be pulled into a client bundle. A `"use server"` file is the one
// thing a client component may import from the server side; the bundler
// replaces it with a reference.

type SubscribeAction = (input: unknown) => Promise<SubscribeOutcome>;

export type SubscribePort = {
  subscribe(email: string): Promise<SubscribeOutcome>;
};

// Assignable to both outcome types, so the two ports share it.
const UNAVAILABLE = { ok: false, error: "unavailable" } as const;

/**
 * The browser-side face of the subscribe Server Action. Injectable so a
 * component test never reaches the network — the same shape as
 * `createOrderStatusPort`.
 */
export function createSubscribePort(action: SubscribeAction = subscribeToNewsletter): SubscribePort {
  return {
    async subscribe(email) {
      try {
        return await action({ email });
      } catch {
        // Offline, or a stale tab calling an action id the new deploy no
        // longer has. The form can only say "try again".
        return UNAVAILABLE;
      }
    },
  };
}

type RestockAction = (input: unknown) => Promise<RestockOutcome>;

export type RestockRequest = {
  email: string;
  productId: number;
  variantId: number;
  /** The unchecked-by-default consent box: also join the newsletter. */
  newsletter: boolean;
};

export type RestockPort = {
  request(input: RestockRequest): Promise<RestockOutcome>;
};

/** Same contract as `createSubscribePort`, for the per-variant restock request. */
export function createRestockPort(action: RestockAction = requestRestockNotice): RestockPort {
  return {
    async request(input) {
      try {
        return await action(input);
      } catch {
        return UNAVAILABLE;
      }
    },
  };
}
