import type { ComponentType, ReactElement } from "react";
import { createElement } from "react";
import { MAX_BATCH_SIZE, type MailMessage } from "../api/mailer";

export type CampaignProps = { baseUrl: string; unsubscribeUrl: string };

/** What a file under `emails/campaigns/` must export. */
export type CampaignTemplate = {
  default: ComponentType<CampaignProps>;
  subject: string;
  previewText: string;
};

export type Recipient = { id: string; email: string };

// Resend allows 10 requests per second per team. Two batches per second leaves
// room for the retries and for anything else sending from the same account, at
// the cost of ~1 minute per 10k subscribers, which a one-off campaign can pay.
export const BATCH_INTERVAL_MS = 500;

/**
 * The subscriber id IS the unsubscribe token (see `unsubscribe` in
 * subscribers.ts), so each recipient needs their own link: a shared one would
 * unsubscribe nobody in particular.
 */
export function unsubscribeLinks(origin: string, token: string) {
  const query = `token=${encodeURIComponent(token)}`;
  return {
    unsubscribeUrl: `${origin}/newsletter/baja?${query}`,
    headers: {
      "List-Unsubscribe": `<${origin}/api/newsletter/unsubscribe?${query}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export function buildCampaignMessage(
  template: CampaignTemplate,
  origin: string,
  recipient: Recipient,
): MailMessage & { react: ReactElement<CampaignProps> } {
  const { unsubscribeUrl, headers } = unsubscribeLinks(origin, recipient.id);
  return {
    to: recipient.email,
    subject: template.subject,
    react: createElement(template.default, { baseUrl: origin, unsubscribeUrl }),
    headers,
  };
}

export function planCampaign(recipientCount: number, fromBatch: number) {
  const batchCount = Math.ceil(recipientCount / MAX_BATCH_SIZE);
  const remainingBatches = Math.max(0, batchCount - fromBatch);
  return { batchCount, remainingBatches, estimatedSeconds: (remainingBatches * BATCH_INTERVAL_MS) / 1000 };
}

/** Re-cuts arbitrary pages into fixed-size batches; the last one keeps the remainder. */
export async function* rebatch<T>(pages: AsyncIterable<T[]>, size: number): AsyncGenerator<T[]> {
  let buffer: T[] = [];
  for await (const page of pages) {
    buffer.push(...page);
    while (buffer.length >= size) {
      yield buffer.slice(0, size);
      buffer = buffer.slice(size);
    }
  }
  if (buffer.length > 0) yield buffer;
}
