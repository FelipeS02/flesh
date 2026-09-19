import type { AnalyticsEvent } from "../events";
import { toMetaEvent, type MetaEventName, type MetaEventParams } from "./adapter";
import { readMetaConfig, type MetaConfig } from "./config";

export type Fbq = (
  command: "track",
  eventName: MetaEventName,
  params: MetaEventParams,
) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type TransportDependencies = {
  config?: MetaConfig | null;
  fbq?: Fbq;
};

/**
 * Same contract as `sendAnalyticsEvent`: never throws, returns whether the
 * event actually left, and is a no-op wherever the destination is not
 * configured — which is every environment until the pixel id is set.
 *
 * `false` covers two different silences on purpose. An unconfigured pixel and
 * an event Meta has no name for are both "nothing was sent", and no caller has
 * anything different to do about them.
 */
export function sendMetaEvent(
  event: AnalyticsEvent,
  dependencies: TransportDependencies = {},
): boolean {
  const config =
    dependencies.config === undefined ? readMetaConfig() : dependencies.config;
  const fbq =
    dependencies.fbq ?? (typeof window === "undefined" ? undefined : window.fbq);

  if (!config || !fbq) return false;

  const metaEvent = toMetaEvent(event);
  if (!metaEvent) return false;

  fbq("track", metaEvent.name, metaEvent.params);
  return true;
}
