import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";
import { forgetAddress } from "./subscribers";

export type ResendWebhookDependencies = {
  /** Read lazily so a missing value fails the request, not the module import. */
  webhookSecret: () => string | undefined;
  /** Throws when the Svix signature does not match the raw body. */
  verify: (payload: string, headers: Headers, webhookSecret: string) => unknown;
  createClient: () => SupabaseClient;
  repository: {
    forgetAddress: (client: SupabaseClient, email: string) => Promise<void>;
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
    repository: { forgetAddress },
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

function logFailure(reason: string, error?: unknown): void {
  // Event type or error class only: the payload carries recipient addresses and
  // the provider's bounce message, and neither may reach a log line.
  console.error(`[newsletter] resend webhook ${reason}`, {
    errorName: error instanceof Error ? error.name : "unknown",
  });
}

/**
 * Deletes every stored trace of an address Resend reports as permanently
 * bounced, so no later campaign mails it again.
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
  if (eventType !== "email.bounced") return new Response(null, { status: 204 });

  const parsed = BouncedEventSchema.safeParse(event);
  if (!parsed.success) return new Response(null, { status: 400 });

  // Transient (full mailbox, greylisting) and undetermined bounces say nothing
  // about whether the address is dead, so they are left alone.
  if (parsed.data.data.bounce.type.toLowerCase() !== "permanent") return new Response(null, { status: 204 });

  try {
    const client = dependencies.createClient();
    for (const address of parsed.data.data.to) {
      await dependencies.repository.forgetAddress(client, address);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    logFailure("failed", error);
    return new Response(null, { status: 503 });
  }
}
