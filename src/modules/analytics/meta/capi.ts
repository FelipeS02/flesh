import "server-only";
import type { MetaUserData } from "./user-data";

const GRAPH_ORIGIN = "https://graph.facebook.com";

/**
 * Meta retires a Graph version roughly two years after it ships, so this is a
 * value that expires. It is overridable by env precisely so a bump does not
 * need a code change the day the calls start failing — and the failure is
 * visible in Events Manager long before it is visible here, because this
 * client swallows everything by design.
 */
const DEFAULT_API_VERSION = "v21.0";

/**
 * Far shorter than the checkout's own 8s. This call sits inside the shopper's
 * checkout submission, and a measurement is never worth making someone wait:
 * if Meta is slow, the event is the thing we drop.
 */
const DEFAULT_TIMEOUT_MS = 3_000;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CapiConfig = {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
};

export type CapiEvent = {
  event_name: "InitiateCheckout";
  event_time: number;
  event_source_url?: string;
  action_source?: "website";
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
};

type CapiEnvironment = {
  NEXT_PUBLIC_META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_GRAPH_API_VERSION?: string;
};

/**
 * Null until BOTH halves are configured, and the pixel id is the same one the
 * browser reports to — two ids would be two pixels, and the server events
 * would land somewhere the campaign is not looking.
 */
export function readCapiConfig(
  environment: CapiEnvironment = {
    // Literal member expressions, like `../config.ts` — `process.env` itself
    // is an index-signature type TypeScript will not narrow to this shape,
    // and the public one still needs the literal form to be substituted at
    // build time if this module is ever read from anywhere but the server.
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
  },
): CapiConfig | null {
  const pixelId = environment.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const accessToken = environment.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !accessToken) return null;

  return {
    pixelId,
    accessToken,
    apiVersion: environment.META_GRAPH_API_VERSION?.trim() || DEFAULT_API_VERSION,
  };
}

type Dependencies = { fetchImpl?: FetchLike; timeoutMs?: number };

/**
 * Sends one server event and answers whether it landed. Never throws, and
 * never reports why.
 *
 * Both are deliberate. This runs inside `startTiendanubeCheckout`, so an
 * exception here would turn a measurement problem into a shopper who cannot
 * buy — and the one detail worth logging, the failure body, is the same place
 * an access token that can write to the ad account has been seen travelling.
 * The boolean is all a caller can act on anyway.
 */
export function createCapiSender(
  config: CapiConfig,
  dependencies: Dependencies = {},
): (event: CapiEvent) => Promise<boolean> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (event) => {
    try {
      const response = await fetchImpl(
        `${GRAPH_ORIGIN}/${config.apiVersion}/${config.pixelId}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // The header, not the query string: a token on a URL is copied
            // into every access log and proxy trace it passes through.
            Authorization: `Bearer ${config.accessToken}`,
          },
          body: JSON.stringify({ data: [event] }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  };
}
