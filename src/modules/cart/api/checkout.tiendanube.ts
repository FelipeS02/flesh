import 'server-only';
import { z } from 'zod';
import type { TiendanubeConfig } from '@/modules/catalog';
import type { CheckoutBuyer } from '../domain/line';
import { isSafeCheckoutUrl } from './checkout-url';

const API_ORIGIN = 'https://api.tiendanube.com';
const DEFAULT_TIMEOUT_MS = 8_000;
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
export type DraftOrderCheckoutRequest = {
  buyer: CheckoutBuyer;
  products: Array<{ variantId: number; quantity: number }>;
};
/**
 * A provider refusal is an expected business outcome, not a transport fault:
 * Tiendanube revalidates stock at creation and names the variants it will not
 * sell, so the adapter returns that instead of collapsing it into an error the
 * caller could only report as "try again".
 */
export type DraftOrderCheckoutResult =
  | { status: 'redirect'; url: string; draftOrderId: number }
  | { status: 'rejected'; variantIds: number[] };
type Dependencies = { fetchImpl?: FetchLike; timeoutMs?: number };
// `id` is required, not optional: a draft order and the order it turns into
// SHARE this id, so it is the only handle the storefront has for asking later
// whether this cart was actually bought. A response without it is unusable, and
// fails closed like any other malformed body.
const DraftOrderResponseSchema = z.object({ id: z.number().int().positive(), checkout_url: z.string() });
const REJECTED_STATUS = 422;
const RejectedVariantsSchema = z.object({
  variant_ids: z.array(z.unknown()).optional(),
  variant_errors: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Why a hand-built detail instead of `cause`: the original exception is exactly
 * where the access token has been seen travelling, so attaching it would move
 * the secret into every log line. Each field here is chosen and non-secret.
 */
export type CheckoutFailureDetail = {
  reason: string;
  status?: number;
  expectedHost?: string;
  receivedHost?: string;
  errorName?: string;
};

export class TiendanubeCheckoutError extends Error {
  readonly detail: CheckoutFailureDetail;
  constructor(detail: CheckoutFailureDetail) {
    super('Tiendanube checkout request failed.');
    this.name = 'TiendanubeCheckoutError';
    // Carried as a property, never folded into `message`: the message is what
    // the shopper-facing error is built from and it must stay sanitized.
    this.detail = detail;
  }
}

/** Issues one non-retried v1 Draft Order request and accepts only exact 201. */
export function createTiendanubeDraftOrderCheckout(
  config: TiendanubeConfig,
  dependencies: Dependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async ({
    buyer,
    products,
  }: DraftOrderCheckoutRequest): Promise<DraftOrderCheckoutResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(
        new URL(`/v1/${config.storeId}/draft_orders`, API_ORIGIN),
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${config.accessToken}`,
            'content-type': 'application/json',
            'user-agent': config.userAgent,
          },
          body: JSON.stringify({
            contact_name: buyer.firstName,
            contact_lastname: buyer.lastName,
            contact_email: buyer.email,
            payment_status: 'unpaid',
            products: products.map(({ variantId, quantity }) => ({
              variant_id: variantId,
              quantity,
            })),
          }),
          signal: controller.signal,
        },
      );
    } catch {
      throw new TiendanubeCheckoutError({ reason: 'network' });
    } finally {
      clearTimeout(timer);
    }
    if (response.status === REJECTED_STATUS) {
      const variantIds = await response
        .json()
        .then(refusedVariantIds)
        .catch(() => []);
      if (variantIds.length === 0)
        throw new TiendanubeCheckoutError({ reason: 'unnamed_rejection', status: REJECTED_STATUS });
      return { status: 'rejected', variantIds };
    }
    if (response.status !== 201)
      throw new TiendanubeCheckoutError({ reason: 'http_status', status: response.status });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new TiendanubeCheckoutError({ reason: 'malformed_body', status: response.status });
    }
    const parsed = DraftOrderResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new TiendanubeCheckoutError({ reason: 'unusable_body', status: response.status });
    // Split from the shape check above rather than folded into one condition: a
    // host mismatch is what a domain or DNS change causes, and it reads to
    // everyone as "checkout is broken" with nothing pointing at the real cause.
    // Both hosts are non-secret, so naming them turns a silent outage into a
    // one-line fix.
    if (!isSafeCheckoutUrl(parsed.data.checkout_url, config.checkoutHost))
      throw new TiendanubeCheckoutError({
        reason: 'unsafe_checkout_url',
        status: response.status,
        expectedHost: config.checkoutHost,
        ...hostOf(parsed.data.checkout_url),
      });
    return { status: 'redirect', url: parsed.data.checkout_url, draftOrderId: parsed.data.id };
  };
}

/** Omits the field when the URL will not parse, rather than reporting a host that was never there. */
function hostOf(value: string): { receivedHost?: string } {
  try {
    return { receivedHost: new URL(value).host };
  } catch {
    return {};
  }
}

/** Reads refused ids from either documented 422 field, tolerating string keys and overlap. */
function refusedVariantIds(body: unknown): number[] {
  const parsed = RejectedVariantsSchema.safeParse(body);
  if (!parsed.success) return [];
  const candidates = [
    ...(parsed.data.variant_ids ?? []),
    ...Object.keys(parsed.data.variant_errors ?? {}),
  ];
  return [
    ...new Set(
      candidates.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ];
}
