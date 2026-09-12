import "server-only";
import { z } from "zod";
import { getCheckoutProducts, readTiendanubeConfig, type CheckoutProduct } from "@/modules/catalog";
import type { CheckoutOutcome } from "./port";
import { createCheckoutRateGuard, type CheckoutRateGuard } from "./checkout.guard";
import { CHECKOUT_FAILURE_REASON } from "./checkout-messages";
import { createTiendanubeDraftOrderCheckout, type DraftOrderCheckoutRequest, type DraftOrderCheckoutResult } from "./checkout.tiendanube";

const MAX_REQUEST_BYTES = 8_192;
const MAX_LINES = 12;
const MAX_QUANTITY = 10;
export { CHECKOUT_FAILURE_REASON };
const BuyerSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254) });
const LineSchema = z.object({ productId: z.number().int().positive().safe(), variantId: z.number().int().positive().safe(), quantity: z.number().int().positive().max(MAX_QUANTITY) });
const CheckoutInputSchema = z.object({ buyer: BuyerSchema, lines: z.array(LineSchema).min(1).max(MAX_LINES) }).superRefine(({ lines }, context) => {
  if (new Set(lines.map((line) => line.variantId)).size !== lines.length) context.addIssue({ code: "custom", message: "Duplicate variant identifiers." });
});
type Dependencies = { getCheckoutProducts: () => Promise<CheckoutProduct[]>; createDraftOrder: (request: DraftOrderCheckoutRequest) => Promise<DraftOrderCheckoutResult>; guard: CheckoutRateGuard };
const defaultGuard = createCheckoutRateGuard();
function defaultDependencies(): Dependencies { return { getCheckoutProducts, createDraftOrder: createTiendanubeDraftOrderCheckout(readTiendanubeConfig()), guard: defaultGuard }; }

/** Validates untrusted input, then reconstructs prices and stock before one mutation. */
export async function startTiendanubeCheckout(input: unknown, dependencies?: Dependencies): Promise<CheckoutOutcome> {
  if (!fitsRequestBudget(input)) return unavailable();
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  try {
    const resolved = dependencies ?? defaultDependencies();
    if (!resolved.guard.consume()) return unavailable();
    const index = checkoutVariantIndex(await resolved.getCheckoutProducts());
    const rejected: number[] = [];
    const products: DraftOrderCheckoutRequest["products"] = [];
    for (const line of parsed.data.lines) {
      const variant = index.get(line.variantId);
      if (!variant || variant.productId !== line.productId || (variant.stockManagement && line.quantity > Math.max(0, variant.stock ?? 0))) rejected.push(line.variantId);
      else products.push({ variantId: variant.variantId, quantity: line.quantity });
    }
    if (rejected.length > 0) return { status: "rejected", lines: rejected };
    const result = await resolved.createDraftOrder({ buyer: parsed.data.buyer, products });
    if (result.status === "redirect") return { status: "redirect", url: result.url };
    // The provider is the stock authority, so its refusal outranks the cached
    // read above — but only for variants this cart actually asked for, so an
    // unrecognised id can never surface as a phantom line in the drawer.
    const requested = new Set(products.map((product) => product.variantId));
    const refused = result.variantIds.filter((variantId) => requested.has(variantId));
    return refused.length > 0 ? { status: "rejected", lines: refused } : unavailable();
  } catch { return unavailable(); }
}
function checkoutVariantIndex(products: CheckoutProduct[]) { return new Map(products.flatMap((product) => product.variants.map((variant) => [variant.variantId, variant] as const))); }
function fitsRequestBudget(input: unknown): boolean { try { return new TextEncoder().encode(JSON.stringify(input)).byteLength <= MAX_REQUEST_BYTES; } catch { return false; } }
function unavailable(): CheckoutOutcome { return { status: "unavailable", reason: CHECKOUT_FAILURE_REASON }; }
