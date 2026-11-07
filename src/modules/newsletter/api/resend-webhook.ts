import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";
import { forgetAddress, unsubscribeAddress } from "./subscribers";

export type ResendWebhookDependencies = {
  /** Read lazily so a missing value fails the request, not the module import. */
  webhookSecret: () => string | undefined;
  /** Throws when the Svix signature does not match the raw body. */
  verify: (payload: string, headers: Headers, webhookSecret: string) => unknown;
  createClient: () => SupabaseClient;
  repository: {
    forgetAddress: (client: SupabaseClient, email: string) => Promise<void>;
    unsubscribeAddress: (client: SupabaseClient, email: string) => Promise<void>;
  };
};

function defaultDependencies(): ResendWebhookDependencies {
  return {
    webhookSecret: () => process.env.RESEND_WEBHOOK_SECRET,
    verify: (payload, headers, webhookSecret) =>
      // Verification is a local HMAC check and never calls the API, but the SDK
      // constructor throws without a key. A placeholder keeps this route from
      // depending on RESEND_API_KEY just to authenticate an inbound request.
      new Resend("verification-only").webhooks.verify({
        payload,
        // A missing header becomes "" so the SDK rejects it as a bad signature.
        headers: {
          id: headers.get("svix-id") ?? "",
          timestamp: headers.get("svix-timestamp") ?? "",
          signature: headers.get("svix-signature") ?? "",
        },
        webhookSecret,
      }),
    createClient: () => createSupabaseServerClient(),
    repository: { forgetAddress, unsubscribeAddress },
  };
}

// Only what the handler acts on. The payload already passed signature
// verification, so a mismatch means Resend changed its contract, not an attack:
// answering 400 surfaces that instead of guessing at a recipient list.
const BouncedEventSchema = z.object({
  type: z.literal("email.bounced"),
  data: z.object({
    to: z.array(z.string().min(1)),
    bounce: z.object({ type: z.string() }),
  }),
});

const ComplainedEventSchema = z.object({
  type: z.literal("email.complained"),
  data: z.object({ to: z.array(z.string().min(1)) }),
});

function logFailure(reason: string, error?: unknown): void {
  // Event type or error class only: the payload carries recipient addresses and
  // the provider's bounce message, and neither may reach a log line.
  console.error(`[newsletter] resend webhook ${reason}`, {
    errorName: error instanceof Error ? error.name : "unknown",
  });
}

/**
 * Keeps the list clean from Resend's delivery feedback:
 * - a permanent bounce DELETES every stored trace of the address, so no later
 *   campaign mails a dead mailbox;
 * - a spam complaint MARKS the subscriber unsubscribed, because it is a consent
 *   withdrawal and the row is its evidence.
 * Every other event is acknowledged and ignored.
 *
 * 204 means handled or deliberately ignored; 400 an invalid signature or
 * payload; 503 missing config or a storage failure, which is what makes Resend
 * retry the delivery.
 */
export async function handleResendWebhook(
  request: Request,
  dependencies: ResendWebhookDependencies = defaultDependencies(),
): Promise<Response> {
  const secret = dependencies.webhookSecret()?.trim();
  if (!secret) {
    // Fail closed: without the secret every request would be unauthenticated.
    console.error("[newsletter] resend webhook misconfigured", { missing: ["RESEND_WEBHOOK_SECRET"] });
    return new Response(null, { status: 503 });
  }

  // The signature covers the exact bytes Resend sent, so the body is read as
  // text and never re-serialized from parsed JSON.
  const rawBody = await request.text();

  let event: unknown;
  try {
    event = dependencies.verify(rawBody, request.headers, secret);
  } catch {
    return new Response(null, { status: 400 });
  }

  const eventType = (event as { type?: unknown } | null)?.type;
  if (eventType === "email.bounced") return handleBounce(event, dependencies);
  if (eventType === "email.complained") return handleComplaint(event, dependencies);
  return new Response(null, { status: 204 });
}

async function handleBounce(event: unknown, dependencies: ResendWebhookDependencies): Promise<Response> {
  const parsed = BouncedEventSchema.safeParse(event);
  if (!parsed.success) return new Response(null, { status: 400 });

  // Transient (full mailbox, greylisting) and undetermined bounces say nothing
  // about whether the address is dead, so they are left alone.
  if (parsed.data.data.bounce.type.toLowerCase() !== "permanent") return new Response(null, { status: 204 });

  return applyToEach(parsed.data.data.to, dependencies, dependencies.repository.forgetAddress);
}

function handleComplaint(event: unknown, dependencies: ResendWebhookDependencies): Promise<Response> | Response {
  const parsed = ComplainedEventSchema.safeParse(event);
  if (!parsed.success) return new Response(null, { status: 400 });

  return applyToEach(parsed.data.data.to, dependencies, dependencies.repository.unsubscribeAddress);
}

async function applyToEach(
  addresses: string[],
  dependencies: ResendWebhookDependencies,
  action: (client: SupabaseClient, email: string) => Promise<void>,
): Promise<Response> {
  try {
    const client = dependencies.createClient();
    for (const address of addresses) {
      await action(client, address);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    logFailure("failed", error);
    return new Response(null, { status: 503 });
  }
}
