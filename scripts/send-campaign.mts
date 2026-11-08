// Sends one disposable newsletter campaign from the owner's machine.
//
//   pnpm campaign <slug>                  dry run: counts, renders one sample, sends nothing
//   pnpm campaign <slug> --to <email>     one real test email to that address
//   pnpm campaign <slug> --send           the whole active list, after typing the slug to confirm
//   pnpm campaign <slug> --send --from-batch <n>   resume after a failed run
//
// Thin shell on purpose: argument parsing, batching, pacing and retries live in
// src/modules/newsletter/campaigns/ where they are unit tested. This file only
// wires the real Supabase, Resend and terminal to them.
//
// Run through the package script, which loads .env.local and a tsconfig that
// maps `server-only` to a no-op (see scripts/tsconfig.campaign.json).

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { createElement } from "react";
import { render } from "react-email";
import { siteUrl } from "../src/lib/site-url";
import { readSupabaseConfig } from "../src/modules/newsletter/api/config";
import { createMailerFromEnvironment, MAX_BATCH_SIZE } from "../src/modules/newsletter/api/mailer";
import { readMailConfig } from "../src/modules/newsletter/api/mail-config";
import { createSupabaseServerClient } from "../src/modules/newsletter/api/supabase";
import { CampaignUsageError, parseCampaignArgs } from "../src/modules/newsletter/campaigns/args";
import { planCampaign, rebatch, unsubscribeLinks, buildCampaignMessage } from "../src/modules/newsletter/campaigns/messages";
import { activeSubscriberPages, countActiveSubscribers } from "../src/modules/newsletter/campaigns/recipients";
import { sendCampaign } from "../src/modules/newsletter/campaigns/runner";
import { campaignFilePath, readCampaignTemplate } from "../src/modules/newsletter/campaigns/template";

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function main(): Promise<number> {
  const args = parseCampaignArgs(process.argv.slice(2));

  const file = campaignFilePath(args.slug);
  if (!existsSync(file)) throw new CampaignUsageError(`No campaign "${args.slug}": ${file} does not exist.`);
  const template = readCampaignTemplate(args.slug, await import(pathToFileURL(file).href));

  const origin = siteUrl().origin;
  const supabase = readSupabaseConfig();
  const mail = readMailConfig();

  // Printed before anything is sent, every time: .env.local may point at
  // production, and this is the last place the owner can notice.
  console.log(`Campaign : ${args.slug}`);
  console.log(`Subject  : ${template.subject}`);
  console.log(`Preview  : ${template.previewText}`);
  console.log(`Supabase : ${new URL(supabase.url).host}`);
  console.log(`From     : ${mail.from}`);
  console.log(`Links to : ${origin}`);

  if (args.mode === "test") return testSend(args.to!, template, origin);

  const client = createSupabaseServerClient();
  const total = await countActiveSubscribers(client);
  const plan = planCampaign(total, args.fromBatch);
  const sample = await render(
    createElement(template.default, { baseUrl: origin, unsubscribeUrl: unsubscribeLinks(origin, "sample").unsubscribeUrl }),
  );
  console.log(`Sample   : rendered OK (${sample.length} bytes of HTML)`);
  console.log(`Active   : ${total} subscribers`);
  console.log(
    `Batches  : ${plan.batchCount} of up to ${MAX_BATCH_SIZE}` +
      (args.fromBatch > 0 ? `, resuming from ${args.fromBatch} (${plan.remainingBatches} left)` : ""),
  );
  console.log(`Duration : ~${plan.estimatedSeconds.toFixed(1)} s of pacing, plus Resend response time`);

  if (args.mode === "dry-run") {
    console.log("\nDry run: nothing was sent. Add --to <email> for a test, or --send for the real run.");
    return 0;
  }
  if (total === 0) {
    console.log("\nNo active subscribers; nothing to send.");
    return 0;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`\nType "${args.slug}" to send to ${total} people: `)).trim();
  rl.close();
  if (typed !== args.slug) {
    console.log("Not confirmed; nothing was sent.");
    return 1;
  }

  const summary = await sendCampaign({
    slug: args.slug,
    template,
    origin,
    batches: rebatch(activeSubscriberPages(client), MAX_BATCH_SIZE),
    mailer: createMailerFromEnvironment(),
    fromBatch: args.fromBatch,
    sleep,
    log: (line) => console.log(line),
  });
  if (summary.ok) {
    console.log(`\nDone: ${summary.recipients} recipients in ${summary.batches} batches.`);
    return 0;
  }
  console.error(
    `\nStopped at batch ${summary.failedBatch} (${summary.reason}); ${summary.sentBatches} batches went out.\n` +
      `Resume the same day with: pnpm campaign ${args.slug} --send --from-batch ${summary.failedBatch}`,
  );
  return 1;
}

async function testSend(to: string, template: Parameters<typeof buildCampaignMessage>[0], origin: string): Promise<number> {
  // A dummy token: the link renders and the header is present, but it matches
  // no subscriber, so clicking it in a test cannot unsubscribe anyone.
  const message = buildCampaignMessage(template, origin, { id: "test-send", email: to });
  const result = await createMailerFromEnvironment().send(message);
  if (!result.ok) {
    console.error(`\nTest send failed (${result.reason}).`);
    return 1;
  }
  console.log(`\nTest email sent to ${to}.`);
  return 0;
}

// exitCode, never process.exit(): on Windows, exiting while Resend's keep-alive
// socket is still closing aborts Node with a libuv assertion (exit 3221226505)
// AFTER the mail went out, which reads as a failed send.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Usage mistakes and config errors are plain messages; anything else keeps
    // its stack, because that is a bug worth seeing.
    if (error instanceof CampaignUsageError) console.error(error.message);
    else if (error instanceof Error && error.name === "NewsletterStorageError") console.error(`${error.message} Check SUPABASE_URL and the network.`);
    else if (error instanceof Error && /^Invalid (Supabase|mail) configuration/.test(error.message)) console.error(error.message);
    else console.error(error);
    process.exitCode = 2;
  },
);
