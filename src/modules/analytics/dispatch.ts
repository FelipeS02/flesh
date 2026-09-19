import type { AnalyticsEvent } from "./events";
import { sendMetaEvent } from "./meta/transport";
import { sendAnalyticsEvent } from "./transport";

export type AnalyticsDestination = (event: AnalyticsEvent) => boolean;

/**
 * GA4 first, Meta second, and the order is load-bearing: GA4 is the
 * measurement the storefront already depends on, so it runs before the
 * destination added afterwards.
 */
export const ANALYTICS_DESTINATIONS: AnalyticsDestination[] = [
  sendAnalyticsEvent,
  sendMetaEvent,
];

/**
 * The one call site for emitting an analytics event, so a component says WHAT
 * happened and never which vendors care. Adding a destination is an edit to the
 * list above instead of an edit to all thirteen callers.
 *
 * Every destination is attempted even if an earlier one fails, and a throw
 * never reaches the caller. Both transports end in a third-party global that
 * this code does not control: before this, an exploding pixel would have taken
 * down a GA4 event that had been working for months, and an analytics call has
 * no business breaking the render that made it.
 */
export function dispatchAnalyticsEvent(
  event: AnalyticsEvent,
  destinations: AnalyticsDestination[] = ANALYTICS_DESTINATIONS,
): boolean {
  let delivered = false;

  for (const send of destinations) {
    try {
      if (send(event)) delivered = true;
    } catch {
      // Swallowed on purpose. There is no recovery a caller could perform, and
      // the alternative — surfacing a vendor's failure into the UI — is worse
      // than losing one measurement.
    }
  }

  return delivered;
}
