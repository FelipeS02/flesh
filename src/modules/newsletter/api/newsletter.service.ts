import "server-only";
import { createElement } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { checkBotId } from "botid/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readClientKey } from "@/lib/client-key";
import { siteUrl } from "@/lib/site-url";
import { getCheckoutProducts, getPurchasableProducts, type CheckoutProduct, type ProductView } from "@/modules/catalog";
import { parseEmail } from "../domain/email";
import WelcomeEmail, { WELCOME_SUBJECT } from "../emails/templates/welcome";
import { createMailerFromEnvironment, type Mailer } from "./mailer";
import { createRateGuard, type RateGuard } from "./rate-guard";
import { requestLaunch } from "./launch-requests";
import { createSupabaseServerClient } from "./supabase";
import { requestRestock, subscribe, type SubscribeResult, type SubscriptionSource } from "./subscribers";

export type SubscribeOutcome = { ok: true } | { ok: false; error: "invalid-email" | "unavailable" };
export type RestockOutcome =
  | { ok: true; status: "created" | "already-requested" }
  | { ok: false; error: "invalid-email" | "unavailable" };

export type LaunchOutcome = RestockOutcome;

export type NewsletterDependencies = {
  createClient: () => SupabaseClient;
  createMailer: () => Mailer;
  /** Runs `task` after the response is sent (`after()` in production). */
  schedule: (task: () => Promise<void>) => void;
  getCheckoutProducts: () => Promise<CheckoutProduct[]>;
  /** Carries `preview`, which the checkout list deliberately lacks. */
  getPurchasableProducts: () => Promise<ProductView[]>;
  clientGuard: RateGuard;
  globalGuard: RateGuard;
  readClientKey: () => Promise<string>;
  isBot: () => Promise<boolean>;
  siteOrigin: () => string;
  /** Off: subscriptions are stored, but nobody is mailed on signup. */
  welcomeEmails: boolean;
  repository: {
    subscribe: (
      client: SupabaseClient,
      input: { email: string; source: SubscriptionSource },
    ) => Promise<SubscribeResult>;
    requestRestock: (
      client: SupabaseClient,
      input: { email: string; productId: number; variantId: number },
    ) => Promise<"created" | "already-requested">;
    requestLaunch: (
      client: SupabaseClient,
      input: { email: string; productId: number },
    ) => Promise<"created" | "already-requested">;
  };
};

// Both forms mail (or store) an address the caller merely typed, and nothing
// proves they own it — so a script could make this store write to anyone, the
// same spam-relay vector `checkout-botid` closed for Tiendanube's draft-order
// email. Verifying ownership would mail a code to the same stranger, so what is
// refused is automation: BotID first, then these budgets.
//
// Per client, 5 per 10 minutes: far above a person fixing a typo or asking
// about a few sold-out sizes, far below what makes a relay worthwhile. The
// global breaker (30 per 10 minutes, one fixed key) caps total mail even when
// client keys are spoofed, and keeps well inside Resend's quota: exhausting it
// only costs welcome emails, never the subscription itself.
const GLOBAL_GUARD_KEY = "global";
const WINDOW_MS = 10 * 60_000;
const defaultClientGuard = createRateGuard({ limit: 5, windowMs: WINDOW_MS });
const defaultGlobalGuard = createRateGuard({ limit: 30, windowMs: WINDOW_MS });

function defaultDependencies(): NewsletterDependencies {
  return {
    createClient: () => createSupabaseServerClient(),
    createMailer: () => createMailerFromEnvironment(),
    schedule: (task) => after(task),
    getCheckoutProducts,
    getPurchasableProducts,
    clientGuard: defaultClientGuard,
    globalGuard: defaultGlobalGuard,
    readClientKey: async () => readClientKey(await headers()),
    // Pinned to `basic`: Deep Analysis bills per call (see checkout.service).
    isBot: async () => (await checkBotId({ advancedOptions: { checkLevel: "basic" } })).isBot,
    siteOrigin: () => siteUrl().origin,
    // Opt-in, so a deploy that forgets the variable stays silent instead of
    // mailing the list before the launch is ready.
    welcomeEmails: process.env.NEWSLETTER_WELCOME_EMAILS === "true",
    repository: { subscribe, requestRestock, requestLaunch },
  };
}

const LaunchInputSchema = z.object({
  email: z.unknown(),
  productId: z.number().int().positive().safe(),
});

const RestockInputSchema = z.object({
  // Validated separately so a bad address is reported as such, not lumped
  // into "unavailable".
  email: z.unknown(),
  productId: z.number().int().positive().safe(),
  variantId: z.number().int().positive().safe(),
  newsletter: z.boolean(),
});

/** Subscribes an address; an already-active one answers exactly like a new one. */
export async function subscribeToNewsletter(
  input: unknown,
  dependencies?: NewsletterDependencies,
): Promise<SubscribeOutcome> {
  const email = parseEmail(typeof input === "object" && input !== null ? (input as { email?: unknown }).email : undefined);
  if (!email) return { ok: false, error: "invalid-email" };

  try {
    const deps = dependencies ?? defaultDependencies();
    const refusal = await refuse(deps);
    if (refusal) return unavailable(refusal);

    await subscribeAndWelcome(deps, email, "newsletter");
    return { ok: true };
  } catch (error) {
    console.log(error)
    return unavailable(error);
  }
}

/** Stores a restock request for a sold-out variant, optionally opting into the newsletter. */
export async function requestRestockNotice(
  input: unknown,
  dependencies?: NewsletterDependencies,
): Promise<RestockOutcome> {
  const parsed = RestockInputSchema.safeParse(input);
  if (!parsed.success) return unavailable({ reason: "invalid_input" });
  const email = parseEmail(parsed.data.email);
  if (!email) return { ok: false, error: "invalid-email" };

  try {
    const deps = dependencies ?? defaultDependencies();
    const refusal = await refuse(deps);
    if (refusal) return unavailable(refusal);

    const { productId, variantId, newsletter } = parsed.data;
    const variant = (await deps.getCheckoutProducts())
      .find((product) => product.productId === productId)
      ?.variants.find((candidate) => candidate.variantId === variantId);
    if (!variant) return unavailable({ reason: "unknown_variant" });
    // A notice for something purchasable right now would mail "it's back" for a
    // thing that never left. Mirrors the catalog's own sold-out rule
    // (`isSoldOut`): without stock management the merchant never sells out.
    if (!(variant.stockManagement && (variant.stock ?? 0) <= 0)) return unavailable({ reason: "in_stock" });

    const status = await deps.repository.requestRestock(deps.createClient(), { email, productId, variantId });
    // Only after the request is stored, and a failure here reports unavailable
    // although the request exists: a retry then lands on "already-requested"
    // and subscribes, so nothing is lost. Restock-only requesters are never
    // written to the subscriber list — consent is the ticked box, nothing else.
    if (newsletter) await subscribeAndWelcome(deps, email, "restock");
    return { ok: true, status };
  } catch (error) {
    return unavailable(error);
  }
}

/** Stores a one-time launch request for a product that is still in preview. */
export async function requestLaunchNotice(
  input: unknown,
  dependencies?: NewsletterDependencies,
): Promise<LaunchOutcome> {
  const parsed = LaunchInputSchema.safeParse(input);
  if (!parsed.success) return unavailable({ reason: "invalid_input" });
  const email = parseEmail(parsed.data.email);
  if (!email) return { ok: false, error: "invalid-email" };

  try {
    const deps = dependencies ?? defaultDependencies();
    const refusal = await refuse(deps);
    if (refusal) return unavailable(refusal);

    // The purchasable list, not the checkout one: preview products are left
    // out of checkout on purpose, so that list can never say "this is a
    // preview". A request for a released product would wait for a launch email
    // that never comes (the webhook fires on the preview flag turning off).
    const product = (await deps.getPurchasableProducts()).find((candidate) => candidate.id === parsed.data.productId);
    if (!product) return unavailable({ reason: "unknown_product" });
    if (!product.preview) return unavailable({ reason: "not_preview" });

    // No newsletter opt-in and no write to `newsletter_subscribers`: the form
    // has no consent box and the shopper asked for exactly one email, the
    // launch notice. Subscribing them would turn a one-off request into a
    // marketing list entry nobody agreed to (Ley 25.326).
    const status = await deps.repository.requestLaunch(deps.createClient(), {
      email,
      productId: parsed.data.productId,
    });
    return { ok: true, status };
  } catch (error) {
    return unavailable(error);
  }
}

/** The shared gate: per-client budget, then bot verdict, then the global breaker. */
async function refuse(deps: NewsletterDependencies): Promise<{ reason: string } | null> {
  // Consumed before any I/O so a hammering client is stopped at its own budget
  // and cannot starve the shared one (same ordering as checkout).
  if (!deps.clientGuard.consume(await deps.readClientKey())) return { reason: "rate_limited" };
  if (await deps.isBot()) return { reason: "bot_detected" };
  if (!deps.globalGuard.consume(GLOBAL_GUARD_KEY)) return { reason: "rate_limited" };
  return null;
}

async function subscribeAndWelcome(
  deps: NewsletterDependencies,
  email: string,
  source: SubscriptionSource,
): Promise<void> {
  const result = await deps.repository.subscribe(deps.createClient(), { email, source });
  // Already-active gets no email: re-mailing on every submit would turn the form
  // into a way to spam a known address, and the answer must not differ anyway.
  if (result.status === "already-active" || !deps.welcomeEmails) return;

  // After the response, so the shopper does not wait on Resend, and so a
  // failed send can never undo a subscription that is already stored.
  deps.schedule(async () => {
    try {
      const outcome = await deps.createMailer().send(welcomeMessage(deps.siteOrigin(), email, result.id));
      if (!outcome.ok) console.error("[newsletter] welcome_failed", { reason: outcome.reason });
    } catch (error) {

      console.error("[newsletter] welcome_failed", describe(error));
    }
  });
}

function welcomeMessage(origin: string, email: string, token: string) {
  const query = `token=${encodeURIComponent(token)}`;
  return {
    to: email,
    subject: WELCOME_SUBJECT,
    react: createElement(WelcomeEmail, {
      baseUrl: origin,
      unsubscribeUrl: `${origin}/newsletter/baja?${query}`,
    }),
    headers: {
      "List-Unsubscribe": `<${origin}/api/newsletter/unsubscribe?${query}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Only discriminants: a thrown message can carry the address or a secret. */
function describe(cause: unknown): { reason: string; errorName?: string } {
  if (typeof cause === "object" && cause !== null && "reason" in cause) return cause as { reason: string };
  const name = cause === null ? "null" : cause === undefined ? "undefined" : Object.getPrototypeOf(cause)?.constructor?.name;
  return { reason: "unexpected_error", errorName: name ?? "Object" };
}

/** The shopper's answer is identical for every cause; the server log is where they differ. */
function unavailable(cause: unknown): { ok: false; error: "unavailable" } {
  console.error("[newsletter] unavailable", describe(cause));
  return { ok: false, error: "unavailable" };
}
