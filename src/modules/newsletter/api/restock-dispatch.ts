import "server-only";
import { createHash } from "node:crypto";
import { createElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";
import {
  applyRate,
  formatMoney,
  getFreshProductById,
  getPricingPolicy,
  type ProductView,
} from "@/modules/catalog";
import RestockEmail, { restockSubject } from "../emails/templates/restock";
import { createMailerFromEnvironment, MAX_BATCH_SIZE, type Mailer, type MailMessage } from "./mailer";
import { claimRestocks, hasPendingRestock, releaseRestocks, type ClaimedRestock } from "./restock-requests";
import { createSupabaseServerClient } from "./supabase";
import { NewsletterStorageError } from "./subscribers";

export type RestockDispatchDependencies = {
  createClient: () => SupabaseClient;
  createMailer: () => Mailer;
  /** Uncached by contract: the cached snapshot cannot tell that a variant just came back. */
  getFreshProduct: (productId: number) => Promise<ProductView | null>;
  getTransferRateBp: () => Promise<number>;
  siteOrigin: () => string;
  now: () => Date;
};

function defaultDependencies(): RestockDispatchDependencies {
  return {
    createClient: () => createSupabaseServerClient(),
    createMailer: () => createMailerFromEnvironment(),
    getFreshProduct: getFreshProductById,
    getTransferRateBp: async () => (await getPricingPolicy()).transferRateBp,
    siteOrigin: () => siteUrl().origin,
    now: () => new Date(),
  };
}

type Context = {
  client: SupabaseClient;
  mailer: Mailer;
  productId: number;
  product: ProductView;
  origin: string;
  rateBp: number;
};

/**
 * Mails everyone waiting on a variant of this product that is in stock now.
 *
 * Claim-then-send, per the migration contract: the rows are marked notified
 * BEFORE any mail leaves, so a duplicate webhook (the provider delivers at
 * least once) finds nothing left to claim. The price of that ordering is a
 * failure window between claim and send, closed on a best-effort basis by
 * releasing the claim of any chunk that did not go out. If the release itself
 * fails the shopper is not mailed until they ask again: a delayed notice, never
 * a duplicated one, which is the failure this ordering chose.
 *
 * Never throws: it runs inside `after()`, where nobody can act on an error, and
 * logs carry only a reason code, never an address.
 */
export async function dispatchRestockNotices(
  productId: number,
  dependencies?: RestockDispatchDependencies,
): Promise<void> {
  try {
    const deps = dependencies ?? defaultDependencies();
    const client = deps.createClient();
    if (!(await hasPendingRestock(client, productId))) return;

    const product = await deps.getFreshProduct(productId);
    if (!product) return;
    const variantIds = product.variants.filter((variant) => variant.inStock).map((variant) => variant.id);
    if (variantIds.length === 0) return;

    const claims = await claimRestocks(client, { productId, variantIds, now: deps.now() });
    if (claims.length === 0) return;

    const context: Context = {
      client,
      mailer: deps.createMailer(),
      productId,
      product,
      origin: deps.siteOrigin(),
      rateBp: await deps.getTransferRateBp(),
    };
    for (const chunk of chunked(claims, MAX_BATCH_SIZE)) await sendChunk(context, chunk);
  } catch (error) {
    console.error("[newsletter] restock_dispatch_failed", describe(error));
  }
}

async function sendChunk(context: Context, chunk: ClaimedRestock[]): Promise<void> {
  let failure: { reason: string; operation?: string } | null = null;
  try {
    const result = await context.mailer.sendBatch(
      chunk.map((claim) => restockMessage(context, claim)),
      { idempotencyKey: idempotencyKey(context.productId, chunk) },
    );
    if (!result.ok) failure = { reason: result.reason };
  } catch (error) {
    failure = describe(error);
  }
  if (!failure) return;

  console.error("[newsletter] restock_dispatch_failed", failure);
  try {
    await releaseRestocks(context.client, chunk.map((claim) => claim.id));
  } catch (error) {
    console.error("[newsletter] restock_release_failed", describe(error));
  }
}

function restockMessage({ product, origin, rateBp }: Context, claim: ClaimedRestock): MailMessage {
  const variant = product.variants.find((candidate) => candidate.id === claim.variantId);
  // Combination values are already in axis order; a product with no options has none.
  const label = variant?.combination.join(" / ") || "Talle único";
  return {
    to: claim.email,
    subject: restockSubject(product.title, label),
    react: createElement(RestockEmail, {
      baseUrl: origin,
      productName: product.title,
      variantLabel: label,
      price: variant ? formatMoney(applyRate(variant.price, rateBp)) : "",
      imageUrl: product.images[0]?.src ?? `${origin}/email/logotype.png`,
      productUrl: `${origin}/producto/${product.slug}`,
    }),
  };
}

/**
 * Deterministic per chunk: the same claimed rows always map to the same key, so
 * if Resend accepted a batch whose response we never saw, a retry of that exact
 * set is deduplicated by the provider instead of mailing twice. Sorted so the
 * order the database happened to return rows in cannot change it.
 */
function idempotencyKey(productId: number, chunk: ClaimedRestock[]): string {
  const digest = createHash("sha256")
    .update(chunk.map((claim) => claim.id).sort().join(","))
    .digest("hex")
    .slice(0, 24);
  return `restock/${productId}/${digest}`;
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

/** Only discriminants: a thrown message can carry an address or a secret. */
function describe(cause: unknown): { reason: string; operation?: string } {
  if (cause instanceof NewsletterStorageError) return { reason: "storage_error", operation: cause.operation };
  return { reason: "unexpected_error" };
}
