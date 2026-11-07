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
  isProductInPreview,
  type ProductView,
} from "@/modules/catalog";
import LaunchEmail, { launchSubject } from "../emails/templates/launch";
import { claimLaunches, hasPendingLaunch, releaseLaunches, type ClaimedLaunch } from "./launch-requests";
import { createMailerFromEnvironment, MAX_BATCH_SIZE, type Mailer, type MailMessage } from "./mailer";
import { createSupabaseServerClient } from "./supabase";
import { NewsletterStorageError } from "./subscribers";

export type LaunchDispatchDependencies = {
  createClient: () => SupabaseClient;
  createMailer: () => Mailer;
  /** Uncached by contract, but its `preview` is always false: ask `isInPreview` for that. */
  getFreshProduct: (productId: number) => Promise<ProductView | null>;
  /** Live and fail-closed: throws on anything but a definite answer. */
  isInPreview: (productId: number) => Promise<boolean>;
  getTransferRateBp: () => Promise<number>;
  siteOrigin: () => string;
  now: () => Date;
};

function defaultDependencies(): LaunchDispatchDependencies {
  return {
    createClient: () => createSupabaseServerClient(),
    createMailer: () => createMailerFromEnvironment(),
    getFreshProduct: getFreshProductById,
    isInPreview: isProductInPreview,
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
  price: string;
};

/**
 * Mails everyone who asked to be told when this product goes live, once it has.
 *
 * Claim-then-send, as the restock dispatch does: the rows are marked notified
 * BEFORE any mail leaves, so a duplicate webhook (the provider delivers at
 * least once) finds nothing left to claim. A failed chunk is released on a
 * best-effort basis; if the release itself fails the shopper is not mailed
 * until they ask again: a delayed notice, never a duplicated one.
 *
 * Every gate before the claim leaves the rows pending, because this runs on
 * EVERY product edit: still in preview, product gone, or nothing buyable yet
 * (a launch mail for something nobody can purchase is worse than waiting; the
 * next update retries). The preview check throws rather than guessing, so an
 * unreadable flag can never be taken for "released".
 *
 * Never throws: it runs inside `after()`, where nobody can act on an error, and
 * logs carry only a reason code, never an address.
 */
export async function dispatchLaunchNotices(
  productId: number,
  dependencies?: LaunchDispatchDependencies,
): Promise<void> {
  try {
    const deps = dependencies ?? defaultDependencies();
    const client = deps.createClient();
    if (!(await hasPendingLaunch(client, productId))) return;
    if (await deps.isInPreview(productId)) return;

    const product = await deps.getFreshProduct(productId);
    if (!product) return;
    const inStock = product.variants.filter((variant) => variant.inStock);
    if (inStock.length === 0) return;

    const claims = await claimLaunches(client, { productId, now: deps.now() });
    if (claims.length === 0) return;

    const rateBp = await deps.getTransferRateBp();
    const prices = inStock.map((variant) => applyRate(variant.price, rateBp));
    const cheapest = prices.reduce((low, price) => (price.amount < low.amount ? price : low));
    const differ = prices.some((price) => price.amount !== cheapest.amount);
    const context: Context = {
      client,
      mailer: deps.createMailer(),
      productId,
      product,
      origin: deps.siteOrigin(),
      price: `${differ ? "Desde " : ""}${formatMoney(cheapest)}`,
    };
    for (const chunk of chunked(claims, MAX_BATCH_SIZE)) await sendChunk(context, chunk);
  } catch (error) {
    console.error("[newsletter] launch_dispatch_failed", describe(error));
  }
}

async function sendChunk(context: Context, chunk: ClaimedLaunch[]): Promise<void> {
  let failure: { reason: string; operation?: string } | null = null;
  try {
    const result = await context.mailer.sendBatch(
      chunk.map((claim) => launchMessage(context, claim)),
      { idempotencyKey: idempotencyKey(context.productId, chunk) },
    );
    if (!result.ok) failure = { reason: result.reason };
  } catch (error) {
    failure = describe(error);
  }
  if (!failure) return;

  console.error("[newsletter] launch_dispatch_failed", failure);
  try {
    await releaseLaunches(context.client, chunk.map((claim) => claim.id));
  } catch (error) {
    console.error("[newsletter] launch_release_failed", describe(error));
  }
}

function launchMessage({ product, origin, price }: Context, claim: ClaimedLaunch): MailMessage {
  return {
    to: claim.email,
    subject: launchSubject(product.title),
    react: createElement(LaunchEmail, {
      baseUrl: origin,
      productName: product.title,
      price,
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
function idempotencyKey(productId: number, chunk: ClaimedLaunch[]): string {
  const digest = createHash("sha256")
    .update(chunk.map((claim) => claim.id).sort().join(","))
    .digest("hex")
    .slice(0, 24);
  return `launch/${productId}/${digest}`;
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
