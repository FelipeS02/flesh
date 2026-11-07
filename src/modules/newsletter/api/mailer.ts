import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { readMailConfig, type MailConfig } from "./mail-config";

// Resend rejects larger batches outright; callers chunk instead of the adapter
// silently splitting, because the idempotency key is scoped to one batch.
export const MAX_BATCH_SIZE = 100;

export type MailMessage = {
  to: string;
  subject: string;
  react: ReactElement;
  headers?: Record<string, string>;
};

export type MailFailureReason = "rate-limited" | "rejected" | "network" | "batch-too-large";

export type MailResult = { ok: true; ids: string[] } | { ok: false; reason: MailFailureReason };

export type Mailer = {
  send(message: MailMessage): Promise<MailResult>;
  sendBatch(messages: MailMessage[], options: { idempotencyKey: string }): Promise<MailResult>;
};

type OutgoingEmail = MailMessage & { from: string; replyTo?: string };
type ProviderError = { name?: string; message?: string } | null;

/** The slice of the Resend SDK the mailer needs, so tests never touch the network. */
export type ResendLikeClient = {
  send(email: OutgoingEmail): Promise<{ data: { id: string } | null; error: ProviderError }>;
  sendBatch(
    emails: OutgoingEmail[],
    options: { idempotencyKey: string },
  ): Promise<{ data: { data: { id: string }[] } | null; error: ProviderError }>;
};

function defaultClient(apiKey: string): ResendLikeClient {
  const resend = new Resend(apiKey);
  return {
    send: (email) => resend.emails.send(email),
    sendBatch: (emails, options) => resend.batch.send(emails, options),
  };
}

function reasonFor(error: NonNullable<ProviderError>): MailFailureReason {
  // Only the provider's error *name* is read: its message echoes recipient
  // addresses, and those must never reach a log line.
  return error.name === "rate_limit_exceeded" || error.name === "daily_quota_exceeded"
    ? "rate-limited"
    : "rejected";
}

export function createResendMailer(
  config: Pick<MailConfig, "from" | "replyTo">,
  client: ResendLikeClient,
): Mailer {
  const withSender = (message: MailMessage): OutgoingEmail => ({
    from: config.from,
    replyTo: config.replyTo,
    ...message,
  });

  return {
    async send(message) {
      try {
        const { data, error } = await client.send(withSender(message));
        if (error) return { ok: false, reason: reasonFor(error) };
        // No data and no error would otherwise read as a success with no id.
        if (!data) return { ok: false, reason: "rejected" };
        return { ok: true, ids: [data.id] };
      } catch {
        return { ok: false, reason: "network" };
      }
    },

    async sendBatch(messages, options) {
      if (messages.length > MAX_BATCH_SIZE) return { ok: false, reason: "batch-too-large" };
      try {
        const { data, error } = await client.sendBatch(messages.map(withSender), options);
        if (error) return { ok: false, reason: reasonFor(error) };
        if (!data) return { ok: false, reason: "rejected" };
        return { ok: true, ids: data.data.map((entry) => entry.id) };
      } catch {
        return { ok: false, reason: "network" };
      }
    },
  };
}

export function createMailerFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): Mailer {
  const config = readMailConfig(environment);
  return createResendMailer(config, defaultClient(config.apiKey));
}
