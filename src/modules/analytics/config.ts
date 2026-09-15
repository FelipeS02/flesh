export type AnalyticsConfig = { measurementId: string };

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

type AnalyticsEnvironment = { NEXT_PUBLIC_GA_MEASUREMENT_ID?: string };

/**
 * The default argument reads the LITERAL `process.env.NEXT_PUBLIC_*` member
 * expression on purpose, and that is the whole reason this object exists.
 *
 * Next only substitutes public env vars into the client bundle where it can see
 * that exact expression in the source. Taking `process.env` as the parameter
 * default instead — which this did — aliases it behind a variable, so no
 * substitution happens and the browser reads `undefined`. The root layout kept
 * working because it renders on the server, where `process.env` is real, so the
 * tag loaded with a valid id while every client event was dropped in silence.
 *
 * Keep the parameter for injection, never widen it back to `process.env`.
 */
export function readAnalyticsConfig(
  environment: AnalyticsEnvironment = {
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
): AnalyticsConfig | null {
  const measurementId = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

  return measurementId && MEASUREMENT_ID_PATTERN.test(measurementId)
    ? { measurementId }
    : null;
}

function assertMeasurementId(measurementId: string): void {
  if (!MEASUREMENT_ID_PATTERN.test(measurementId)) {
    throw new Error("Invalid GA4 measurement id.");
  }
}

export function googleTagSource(measurementId: string): string {
  assertMeasurementId(measurementId);
  return `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
}

export function googleTagBootstrap(measurementId: string): string {
  assertMeasurementId(measurementId);

  return [
    "window.dataLayer=window.dataLayer||[]",
    "function gtag(){dataLayer.push(arguments)}",
    "window.gtag=gtag",
    "gtag('js',new Date())",
    `gtag('config','${measurementId}',{send_page_view:false})`,
  ].join(";");
}
