import "server-only";
import { z } from "zod";
import { getCheckoutProducts, readTiendanubeConfig, type CheckoutProduct } from "@/modules/catalog";
import type { CheckoutOutcome } from "./port";
import { createCheckoutRateGuard, type CheckoutRateGuard } from "./checkout.guard";
import { logCheckoutFailure } from "./checkout.diagnostics";
import { CHECKOUT_FAILURE_REASON } from "./checkout-messages";
import { createTiendanubeDraftOrderCheckout, type DraftOrderCheckoutRequest, type DraftOrderCheckoutResult } from "./checkout.tiendanube";
import { readBuyerCookie, writeBuyerCookie } from "./buyer-profile.cookie";
import { writePendingOrderCookie } from "./pending-order.cookie";
import type { CheckoutLine } from "@/modules/analytics/meta/initiate-checkout";
import { reportCheckoutStarted } from "@/modules/analytics/meta/report-checkout";

const MAX_REQUEST_BYTES = 8_192;
const MAX_LINES = 12;
const MAX_QUANTITY = 10;
export { CHECKOUT_FAILURE_REASON };
export const BuyerSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254) });
export type BuyerResolution =
  | { source: "submitted"; buyer: z.infer<typeof BuyerSchema> }
  | { source: "cookie"; buyer: z.infer<typeof BuyerSchema> }
  | { source: "none" };

/**
 * Both inputs are `unknown`, and both go through the same schema — a stale
 * or hand-edited cookie fails closed instead of ever reaching the draft
 * order call (spec "Buyer Resolution Precedence": tampered cookie fails closed).
 */
export function resolveBuyer(submitted: unknown, stored: unknown): BuyerResolution {
  const submittedResult = BuyerSchema.safeParse(submitted);
  if (submittedResult.success) return { source: "submitted", buyer: submittedResult.data };
  const storedResult = BuyerSchema.safeParse(stored);
  if (storedResult.success) return { source: "cookie", buyer: storedResult.data };
  return { source: "none" };
}
const LineSchema = z.object({ productId: z.number().int().positive().safe(), variantId: z.number().int().positive().safe(), quantity: z.number().int().positive().max(MAX_QUANTITY) });
const CheckoutInputSchema = z.object({ buyer: BuyerSchema.optional(), lines: z.array(LineSchema).min(1).max(MAX_LINES) }).superRefine(({ lines }, context) => {
  if (new Set(lines.map((line) => line.variantId)).size !== lines.length) context.addIssue({ code: "custom", message: "Duplicate variant identifiers." });
});
type Dependencies = {
  getCheckoutProducts: () => Promise<CheckoutProduct[]>;
  createDraftOrder: (request: DraftOrderCheckoutRequest) => Promise<DraftOrderCheckoutResult>;
  guard: CheckoutRateGuard;
  readBuyer: () => Promise<unknown>;
  writeBuyer: (buyer: z.infer<typeof BuyerSchema>) => Promise<void>;
  writePendingOrder: (draftOrderId: number) => Promise<void>;
  reportCheckoutStarted: (input: {
    buyer: z.infer<typeof BuyerSchema>;
    lines: CheckoutLine[];
  }) => Promise<void>;
};
const defaultGuard = createCheckoutRateGuard();
function defaultDependencies(): Dependencies {
  return {
    getCheckoutProducts,
    createDraftOrder: createTiendanubeDraftOrderCheckout(readTiendanubeConfig()),
    guard: defaultGuard,
    readBuyer: readBuyerCookie,
    writeBuyer: writeBuyerCookie,
    writePendingOrder: writePendingOrderCookie,
    reportCheckoutStarted,
  };
}

/** Validates untrusted input, then reconstructs prices and stock before one mutation. */
export async function startTiendanubeCheckout(input: unknown, dependencies?: Dependencies): Promise<CheckoutOutcome> {
  if (!fitsRequestBudget(input)) return unavailable({ reason: "oversized_request" });
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return unavailable({ reason: "invalid_input" });
  try {
    const resolved = dependencies ?? defaultDependencies();
    if (!resolved.guard.consume()) return unavailable({ reason: "rate_limited" });
    // Resolved before any catalog/provider I/O: a submission with no usable
    // identity (source "none") has nothing to check stock for.
    const resolution = resolveBuyer(parsed.data.buyer, await resolved.readBuyer());
    if (resolution.source === "none") return unavailable({ reason: "no_buyer_identity" });
    const index = checkoutVariantIndex(await resolved.getCheckoutProducts());
    const rejected: number[] = [];
    const products: DraftOrderCheckoutRequest["products"] = [];
    // Carries the RECONSTRUCTED price alongside each accepted line. Meta has
    // to be told the same figure the draft order is built from: reporting the
    // client's number would teach the ad algorithm to bid against a value a
    // shopper can edit in the request.
    const pricedLines: CheckoutLine[] = [];
    for (const line of parsed.data.lines) {
      const variant = index.get(line.variantId);
      if (!variant || variant.productId !== line.productId || (variant.stockManagement && line.quantity > Math.max(0, variant.stock ?? 0))) rejected.push(line.variantId);
      else {
        products.push({ variantId: variant.variantId, quantity: line.quantity });
        pricedLines.push({ variantId: variant.variantId, quantity: line.quantity, price: variant.price });
      }
    }
    if (rejected.length > 0) return { status: "rejected", lines: rejected };
    // Per spec amendment A2: the cookie records IDENTITY, not order success —
    // written here, before the provider call, so a shopper rejected for stock
    // never has to retype their name to retry. Only a fresh submission
    // rewrites it; a resolution already sourced from the cookie has nothing
    // new to persist.
    if (resolution.source === "submitted") await resolved.writeBuyer(resolution.buyer);
    const result = await resolved.createDraftOrder({ buyer: resolution.buyer, products });
    if (result.status === "redirect") {
      // Recorded only for a real handoff, and unlike the buyer cookie this one
      // records an ATTEMPT rather than an identity: it is the id the cart asks
      // about on the shopper's return to find out whether it was bought.
      await resolved.writePendingOrder(result.draftOrderId);
      // Only on a real handoff, and never allowed to matter: the report runs
      // after the response is sent, and a rejection here is caught so a
      // measurement can never be the reason a shopper fails to reach checkout.
      await resolved.reportCheckoutStarted({ buyer: resolution.buyer, lines: pricedLines }).catch(() => {});
      return { status: "redirect", url: result.url, draftOrderId: result.draftOrderId };
    }
    // The provider is the stock authority, so its refusal outranks the cached
    // read above — but only for variants this cart actually asked for, so an
    // unrecognised id can never surface as a phantom line in the drawer.
    const requested = new Set(products.map((product) => product.variantId));
    const refused = result.variantIds.filter((variantId) => requested.has(variantId));
    // A refusal naming variants is an ANSWER, not a fault, and the caller
    // already turns it into a specific message — logging it would bury the
    // faults this diagnostic exists to surface under ordinary out-of-stock noise.
    return refused.length > 0 ? { status: "rejected", lines: refused } : unavailable({ reason: "unnamed_rejection" });
  } catch (error) { return unavailable(error); }
}
function checkoutVariantIndex(products: CheckoutProduct[]) { return new Map(products.flatMap((product) => product.variants.map((variant) => [variant.variantId, variant] as const))); }
function fitsRequestBudget(input: unknown): boolean { try { return new TextEncoder().encode(JSON.stringify(input)).byteLength <= MAX_REQUEST_BYTES; } catch { return false; } }
/**
 * The shopper's outcome is deliberately identical for every cause; the server
 * log is where they stop being identical. Both halves live here so the two can
 * never drift apart again — the silence towards the operator was a side effect
 * of the silence towards the shopper, not a decision anyone made.
 */
function unavailable(cause?: unknown): CheckoutOutcome {
  if (cause !== undefined) logCheckoutFailure(cause);
  return { status: "unavailable", reason: CHECKOUT_FAILURE_REASON };
}
