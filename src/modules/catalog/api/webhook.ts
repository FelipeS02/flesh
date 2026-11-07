import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { readTiendanubeConfig } from "./config";
import { CATALOG_CACHE_TAG } from "./source";

const SIGNATURE_HEADER = "x-linkedstore-hmac-sha256";
// The signature proves the delivery came from our APP, not from our store: the
// client secret is app-scoped, so the same app installed on a test store signs
// its webhooks with the identical secret. Only the payload names the store.
const WebhookPayloadSchema = z.object({
  // Sent as a string on some deliveries and a number on others — pinning
  // either primitive would silently drop half of the real traffic.
  store_id: z.union([z.string(), z.number()]).transform(String),
});
// Read apart from the store check, and each field forgiven on its own: a
// malformed `id` must cost only the product hook, never the store check above
// it, which decides whether this delivery may invalidate our cache at all.
const ProductEventSchema = z.object({
  id: z
    .union([z.number(), z.string()])
    .transform(Number)
    .pipe(z.number().int().positive().safe())
    .optional()
    .catch(undefined),
  event: z.string().optional().catch(undefined),
});
// Stale-while-revalidate. The provider drops a delivery that takes longer than
// three seconds, so the handler only marks the tag and lets the next request
// pay for the refetch. `updateTag` would expire immediately but is restricted
// to Server Actions, so it cannot be reached from a route handler.
const REVALIDATE_PROFILE = "max";

type Dependencies = {
  secret: string;
  storeId: string;
  revalidate: (tag: string) => void;
  /**
   * Called with the id of a product Tiendanube says changed, once the delivery
   * is authentic, ours, and the cache is marked stale.
   *
   * Injected instead of imported because the dependency must point from the
   * composition root (the route under `app/`) into both modules, never from
   * catalog into newsletter: catalog is the lower layer the newsletter already
   * reads from, and a back-edge would make the two import each other. The hook
   * is also what keeps this handler free of any work that could outlive the
   * provider's three-second window — the caller decides how to defer it.
   */
  onProductUpdated?: (productId: number) => void;
};

/**
 * Read on its own rather than through `readTiendanubeConfig`: that schema is
 * required, so folding the webhook secret into it would stop the storefront
 * and checkout from booting on any deployment that receives no webhooks.
 */
export function readCatalogWebhookSecret(
  environment: Record<string, string | undefined> = process.env,
): string {
  const secret = environment.TIENDANUBE_APP_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("Invalid Tiendanube webhook configuration: TIENDANUBE_APP_CLIENT_SECRET.");
  return secret;
}

function resolveDependencies(overrides: Partial<Dependencies>): Dependencies {
  // Defaults are read lazily so a caller (or test) that supplies everything
  // does not need the environment, as before the hook existed.
  const complete = overrides.secret !== undefined && overrides.storeId !== undefined && overrides.revalidate !== undefined;
  return complete ? (overrides as Dependencies) : { ...defaultDependencies(), ...overrides };
}

function defaultDependencies(): Dependencies {
  return {
    secret: readCatalogWebhookSecret(),
    storeId: readTiendanubeConfig().storeId,
    revalidate: (tag) => revalidateTag(tag, REVALIDATE_PROFILE),
  };
}

/**
 * Verifies one Tiendanube webhook, then marks the catalog snapshot stale.
 *
 * The route is public, so an unverified request would be a free cache-buster:
 * one cheap POST forces a paginated snapshot refetch on the next visit, which
 * an attacker can repeat until the provider rate limit is drained and the
 * storefront can no longer load its catalog at all.
 *
 * Never fetches anything itself, and revalidation is idempotent — which is
 * exactly what the provider's documented at-least-once, duplicate-prone
 * delivery requires.
 */
export async function handleCatalogWebhook(
  request: Request,
  dependencies: Partial<Dependencies> = {},
): Promise<Response> {
  const raw = await request.text();
  const resolved = resolveDependencies(dependencies);
  if (!isAuthentic(raw, request.headers.get(SIGNATURE_HEADER), resolved.secret)) {
    return new Response(null, { status: 401 });
  }
  // An authentic delivery for another store is accepted and ignored: answering
  // with an error would earn 48 hours of retries for a request that was fine.
  if (namesAnotherStore(raw, resolved.storeId)) return new Response(null, { status: 204 });
  resolved.revalidate(CATALOG_CACHE_TAG);
  const productId = changedProductId(raw);
  if (productId !== null && resolved.onProductUpdated) {
    try {
      resolved.onProductUpdated(productId);
    } catch {
      // The cache is already marked stale, so this delivery did its job. A 5xx
      // would only buy 48 hours of retries for a failure that is not the
      // delivery's, and the next product edit triggers the hook again.
    }
  }
  return new Response(null, { status: 204 });
}

/**
 * The product a `product/updated` delivery names, or null when it names none.
 * An absent event is accepted — the subscription is for product/updated only —
 * but a different event is not: a deletion carries an id too, and no stock
 * came back for a product that is gone.
 */
function changedProductId(raw: string): number | null {
  const parsed = ProductEventSchema.safeParse(parseJson(raw));
  if (!parsed.success || parsed.data.id === undefined) return null;
  const { event } = parsed.data;
  return event === undefined || event === "product/updated" ? parsed.data.id : null;
}

/**
 * True only for a delivery that positively identifies a DIFFERENT store.
 *
 * An unreadable payload deliberately returns false and lets the invalidation
 * through. The two staleness directions are not symmetric: serving stock that
 * is gone ends in a visible provider rejection the buyer can recover from,
 * while hiding stock that exists loses the sale in silence, with no error and
 * nothing to notice. So when the store cannot be established, prefer freshness.
 */
function namesAnotherStore(raw: string, storeId: string): boolean {
  const parsed = WebhookPayloadSchema.safeParse(parseJson(raw));
  return parsed.success && parsed.data.store_id !== storeId;
}

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return undefined; }
}

/**
 * Digests the RAW body. Parsing and re-serialising would not reproduce the
 * signed bytes: the provider sends `store_id` as a string on some deliveries
 * and a number on others, so the exact encoding is not ours to reconstruct.
 */
type RejectionReason = "missing-signature" | "malformed-signature" | "signature-mismatch";

function isAuthentic(raw: string, signature: string | null, secret: string): boolean {
  const reason = rejectionReason(raw, signature, secret);
  // A bare 401 cannot tell a provider that stopped signing from a deployment
  // holding the wrong secret. Only the reason is logged: the header is
  // caller-controlled and the body carries store data.
  if (reason) console.warn("[catalog] tiendanube webhook rejected", { reason });
  return reason === null;
}

function rejectionReason(raw: string, signature: string | null, secret: string): RejectionReason | null {
  if (!signature) return "missing-signature";
  const expected = createHmac("sha256", secret).update(raw).digest();
  // A caller-controlled header reaches this line, and invalid hex truncates
  // rather than throwing, so the length is checked before `timingSafeEqual`,
  // which throws on mismatched lengths. The comparison itself stays constant
  // time so a wrong digest never reveals how many leading bytes were right.
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length) return "malformed-signature";
  return timingSafeEqual(received, expected) ? null : "signature-mismatch";
}
