import type { Mailer } from "../api/mailer";
import { BATCH_INTERVAL_MS, buildCampaignMessage, type CampaignTemplate, type Recipient } from "./messages";

export type CampaignSummary =
  | { ok: true; batches: number; recipients: number }
  | { ok: false; failedBatch: number; reason: string; sentBatches: number };

// A rate limit or a dropped connection says nothing about the batch itself, so
// retrying it is safe; the key is unchanged, so a batch that did land is
// deduplicated by Resend instead of mailed twice. Anything else (a rejected
// payload, a thrown error) would fail identically again.
const RETRYABLE = new Set(["rate-limited", "network"]);
const MAX_RETRIES = 3;
const FIRST_BACKOFF_MS = 1_000;

type RunInput = {
  slug: string;
  template: CampaignTemplate;
  origin: string;
  batches: AsyncIterable<Recipient[]>;
  mailer: Mailer;
  /** Zero-based index of the first batch to send; earlier ones are skipped. */
  fromBatch: number;
  sleep: (milliseconds: number) => Promise<void>;
  log: (line: string) => void;
};

/**
 * Sends the batches one at a time, in order, and stops at the first one that
 * cannot be delivered, naming it so `--from-batch` can pick up exactly there.
 *
 * The key `campaign/<slug>/<index>` is what makes a crashed run resumable:
 * re-running the same batches does not double-send the ones Resend already
 * accepted. Resend remembers a key for about 24 hours, so a resume more than a
 * day later can mail a batch again, and a list that changed in between shifts
 * the later batches under keys already used. Resume the same day, from the
 * index this prints.
 */
export async function sendCampaign(input: RunInput): Promise<CampaignSummary> {
  let index = -1;
  let sentBatches = 0;
  let recipients = 0;

  for await (const batch of input.batches) {
    index += 1;
    if (index < input.fromBatch) continue;
    // Waits BETWEEN sends, so the first one starts immediately.
    if (sentBatches > 0) await input.sleep(BATCH_INTERVAL_MS);

    const failure = await sendWithRetries(input, index, batch);
    if (failure) {
      // Only the reason: a provider message can carry the recipient address.
      input.log(`Batch ${index} failed (${failure}).`);
      return { ok: false, failedBatch: index, reason: failure, sentBatches };
    }
    sentBatches += 1;
    recipients += batch.length;
    input.log(`Batch ${index} sent (${batch.length} recipients).`);
  }
  return { ok: true, batches: sentBatches, recipients };
}

async function sendWithRetries(input: RunInput, index: number, batch: Recipient[]): Promise<string | null> {
  const messages = batch.map((recipient) => buildCampaignMessage(input.template, input.origin, recipient));
  const idempotencyKey = `campaign/${input.slug}/${index}`;

  for (let attempt = 0; ; attempt += 1) {
    let reason: string;
    try {
      const result = await input.mailer.sendBatch(messages, { idempotencyKey });
      if (result.ok) return null;
      reason = result.reason;
    } catch {
      reason = "unexpected_error";
    }
    if (!RETRYABLE.has(reason) || attempt >= MAX_RETRIES) return reason;
    await input.sleep(FIRST_BACKOFF_MS * 2 ** attempt);
  }
}
