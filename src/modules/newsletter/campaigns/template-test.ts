import { createElement } from "react";
import type { MailMessage } from "../api/mailer";
import { parseEmail } from "../domain/email";
import LaunchEmail, { launchSubject } from "../emails/templates/launch";
import RestockEmail, { restockSubject } from "../emails/templates/restock";
import { CampaignUsageError } from "./args";

/**
 * One real copy of a transactional template, mailed from the owner's machine.
 *
 * Exists so a template change can be checked in Gmail or Apple Mail before it
 * is deployed: the dispatches that normally send these only run on Vercel,
 * behind a Tiendanube webhook. The product is the template's own preview
 * fixture, so no catalogue or Supabase access is needed.
 */
const TEMPLATES = ["launch", "restock"] as const;
export type TestTemplateName = (typeof TEMPLATES)[number];

export type TemplateTestArgs = { template: TestTemplateName; to: string; origin?: string };

export const TEMPLATE_TEST_USAGE = `Usage: pnpm email:test <${TEMPLATES.join("|")}> --to <email> [--origin <url>]`;

export function parseTemplateTestArgs(argv: string[]): TemplateTestArgs {
  const positional: string[] = [];
  let to: string | undefined;
  let origin: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const flag = equals === -1 ? arg : arg.slice(0, equals);
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);
    const value = () => {
      const next = inline ?? argv[++index];
      if (next === undefined || next.startsWith("--")) throw new CampaignUsageError(`${flag} needs a value. ${TEMPLATE_TEST_USAGE}`);
      return next;
    };
    if (flag === "--to") to = value();
    else if (flag === "--origin") origin = value();
    else throw new CampaignUsageError(`Unknown option ${flag}. ${TEMPLATE_TEST_USAGE}`);
  }

  if (positional.length === 0) throw new CampaignUsageError(`Missing template. ${TEMPLATE_TEST_USAGE}`);
  if (positional.length > 1) throw new CampaignUsageError(`Give exactly one template. ${TEMPLATE_TEST_USAGE}`);
  const template = positional[0]!;
  if (!isTemplateName(template)) {
    throw new CampaignUsageError(`Unknown template "${template}". ${TEMPLATE_TEST_USAGE}`);
  }

  if (to === undefined) throw new CampaignUsageError(`--to is required: a test goes to one address only. ${TEMPLATE_TEST_USAGE}`);
  const email = parseEmail(to);
  if (!email) throw new CampaignUsageError(`--to needs a valid email address, got "${to}".`);

  if (origin !== undefined && !/^https?:\/\/[^/]/.test(origin)) {
    throw new CampaignUsageError(`--origin must be an absolute http(s) URL, got "${origin}".`);
  }
  return origin === undefined ? { template, to: email } : { template, to: email, origin };
}

export function buildTemplateTestMessage(template: TestTemplateName, origin: string, to: string): MailMessage {
  const base = new URL(origin);
  // Gmail fetches every image through Google's proxy, which cannot reach this
  // machine: a localhost origin would deliver an email with every image broken.
  if (["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
    throw new CampaignUsageError(
      `Origin ${base.origin} is unreachable from a mail client. Pass --origin with a deployed site (e.g. https://dev.flesh.ar) or set SITE_URL.`,
    );
  }
  const baseUrl = base.origin;
  // Same URL shape the dispatches build; the preview fixtures' own URLs point
  // at localhost and must not leak into a real inbox.
  const productUrl = `${baseUrl}/producto/${slugOf(template === "launch" ? LaunchEmail.PreviewProps.productName : RestockEmail.PreviewProps.productName)}`;

  if (template === "launch") {
    const props = { ...LaunchEmail.PreviewProps, baseUrl, productUrl };
    return { to, subject: `[TEST] ${launchSubject(props.productName)}`, react: createElement(LaunchEmail, props) };
  }
  const props = { ...RestockEmail.PreviewProps, baseUrl, productUrl };
  return {
    to,
    subject: `[TEST] ${restockSubject(props.productName, props.variantLabel)}`,
    react: createElement(RestockEmail, props),
  };
}

function isTemplateName(value: string): value is TestTemplateName {
  return (TEMPLATES as readonly string[]).includes(value);
}

function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
