// Mails one real copy of a transactional email to check it in an inbox before
// deploying a template change.
//
//   pnpm email:test launch --to you@example.com
//   pnpm email:test restock --to you@example.com --origin https://dev.flesh.ar
//
// The images (logo, gym floor, font) load from --origin, or SITE_URL when it is
// omitted, so that site must already serve public/email/. Only the template's
// markup comes from this checkout. Same Resend key and sender as .env.local.

import { readMailConfig } from "../src/modules/newsletter/api/mail-config";
import { createMailerFromEnvironment } from "../src/modules/newsletter/api/mailer";
import { CampaignUsageError } from "../src/modules/newsletter/campaigns/args";
import { buildTemplateTestMessage, parseTemplateTestArgs } from "../src/modules/newsletter/campaigns/template-test";
import { siteUrl } from "../src/lib/site-url";

async function main(): Promise<number> {
  const args = parseTemplateTestArgs(process.argv.slice(2));
  const origin = args.origin ?? siteUrl().origin;
  const message = buildTemplateTestMessage(args.template, origin, args.to);

  console.log(`Template : ${args.template}`);
  console.log(`Subject  : ${message.subject}`);
  console.log(`From     : ${readMailConfig().from}`);
  console.log(`Assets   : ${origin}`);

  const result = await createMailerFromEnvironment().send(message);
  if (!result.ok) {
    console.error(`\nSend failed (${result.reason}).`);
    return 1;
  }
  console.log(`\nSent to ${args.to}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // By name, not instanceof: tsx loads args.ts once as ESM for this file and
    // once as CommonJS behind the .tsx templates, so there are two classes.
    if (error instanceof Error && error.name === CampaignUsageError.name) console.error(error.message);
    else if (error instanceof Error && /^Invalid mail configuration/.test(error.message)) console.error(error.message);
    else console.error(error);
    process.exit(2);
  },
);
