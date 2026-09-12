import "server-only";
import { z } from "zod";
import type { TiendanubeConfig } from "@/modules/catalog";
import type { CheckoutBuyer } from "../domain/line";
import { isSafeCheckoutUrl } from "./checkout-url";

const API_ORIGIN = "https://api.tiendanube.com";
const DEFAULT_TIMEOUT_MS = 8_000;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type DraftOrderCheckoutRequest = { buyer: CheckoutBuyer; products: Array<{ variantId: number; quantity: number }> };
/**
 * A provider refusal is an expected business outcome, not a transport fault:
 * Tiendanube revalidates stock at creation and names the variants it will not
 * sell, so the adapter returns that instead of collapsing it into an error the
 * caller could only report as "try again".
 */
export type DraftOrderCheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "rejected"; variantIds: number[] };
type Dependencies = { fetchImpl?: FetchLike; timeoutMs?: number };
const DraftOrderResponseSchema = z.object({ checkout_url: z.string() });
const REJECTED_STATUS = 422;
const RejectedVariantsSchema = z.object({ variant_ids: z.array(z.unknown()).optional(), variant_errors: z.record(z.string(), z.unknown()).optional() });

export class TiendanubeCheckoutError extends Error {
  constructor() { super("Tiendanube checkout request failed."); this.name = "TiendanubeCheckoutError"; }
}

/** Issues one non-retried v1 Draft Order request and accepts only exact 201. */
export function createTiendanubeDraftOrderCheckout(config: TiendanubeConfig, dependencies: Dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async ({ buyer, products }: DraftOrderCheckoutRequest): Promise<DraftOrderCheckoutResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(new URL(`/v1/${config.storeId}/draft_orders`, API_ORIGIN), {
        method: "POST", cache: "no-store", headers: { accept: "application/json", authorization: `Bearer ${config.accessToken}`, "content-type": "application/json", "user-agent": config.userAgent },
        body: JSON.stringify({ contact_name: buyer.firstName, contact_lastname: buyer.lastName, contact_email: buyer.email, payment_status: "unpaid", products: products.map(({ variantId, quantity }) => ({ variant_id: variantId, quantity })) }),
        signal: controller.signal,
      });
    } catch { throw new TiendanubeCheckoutError(); } finally { clearTimeout(timer); }
    if (response.status === REJECTED_STATUS) {
      const variantIds = await response.json().then(refusedVariantIds).catch(() => []);
      if (variantIds.length === 0) throw new TiendanubeCheckoutError();
      return { status: "rejected", variantIds };
    }
    if (response.status !== 201) throw new TiendanubeCheckoutError();
    let body: unknown;
    try { body = await response.json(); } catch { throw new TiendanubeCheckoutError(); }
    const parsed = DraftOrderResponseSchema.safeParse(body);
    if (!parsed.success || !isSafeCheckoutUrl(parsed.data.checkout_url)) throw new TiendanubeCheckoutError();
    return { status: "redirect", url: parsed.data.checkout_url };
  };
}

/** Reads refused ids from either documented 422 field, tolerating string keys and overlap. */
function refusedVariantIds(body: unknown): number[] {
  const parsed = RejectedVariantsSchema.safeParse(body);
  if (!parsed.success) return [];
  const candidates = [...(parsed.data.variant_ids ?? []), ...Object.keys(parsed.data.variant_errors ?? {})];
  return [...new Set(candidates.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
}
