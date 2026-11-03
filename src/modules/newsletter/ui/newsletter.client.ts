import type { SubscribeOutcome } from "../api/newsletter.service";
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

const UNAVAILABLE: SubscribeOutcome = { ok: false, error: "unavailable" };

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
