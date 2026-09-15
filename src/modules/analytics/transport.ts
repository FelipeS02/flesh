import { readAnalyticsConfig, type AnalyticsConfig } from "./config";
import { isAnalyticsEventName, type AnalyticsEvent } from "./events";

export type Gtag = (
  command: "event",
  eventName: AnalyticsEvent["name"],
  params: AnalyticsEvent["params"],
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

type TransportDependencies = {
  config?: AnalyticsConfig | null;
  gtag?: Gtag;
};

export function sendAnalyticsEvent(
  event: AnalyticsEvent,
  dependencies: TransportDependencies = {},
): boolean {
  const config =
    dependencies.config === undefined
      ? readAnalyticsConfig()
      : dependencies.config;
  const gtag =
    dependencies.gtag ??
    (typeof window === "undefined" ? undefined : window.gtag);

  if (!config || !gtag || !isAnalyticsEventName(event.name)) return false;

  gtag("event", event.name, event.params);
  return true;
}
