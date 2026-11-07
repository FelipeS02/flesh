import { parseEmail } from "../domain/email";

export type CampaignArgs = {
  slug: string;
  /** `dry-run` sends nothing; `test` mails one address; `send` mails the whole list. */
  mode: "dry-run" | "test" | "send";
  to?: string;
  fromBatch: number;
};

/** A usage mistake, reported as a plain message with no stack. */
export class CampaignUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignUsageError";
  }
}

// The slug is turned into a file path and imported, so it is held to a shape
// that cannot name a parent folder or another extension.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const USAGE = "Usage: pnpm campaign <slug> [--to <email>] [--send [--from-batch <n>]]";

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new CampaignUsageError(`${flag} needs a value. ${USAGE}`);
  return value;
}

export function parseCampaignArgs(argv: string[]): CampaignArgs {
  const positional: string[] = [];
  let send = false;
  let to: string | undefined;
  let fromBatch: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const [flag, inline] = arg.startsWith("--") ? splitFlag(arg) : [arg, undefined];
    if (!arg.startsWith("--")) {
      positional.push(arg);
    } else if (flag === "--send") {
      send = true;
    } else if (flag === "--to") {
      to = inline ?? takeValue(argv, index++, flag);
    } else if (flag === "--from-batch") {
      const raw = inline ?? takeValue(argv, index++, flag);
      if (!/^\d+$/.test(raw)) throw new CampaignUsageError(`--from-batch must be a whole number, got "${raw}".`);
      fromBatch = Number(raw);
    } else {
      throw new CampaignUsageError(`Unknown option ${flag}. ${USAGE}`);
    }
  }

  if (positional.length === 0) throw new CampaignUsageError(`Missing campaign slug. ${USAGE}`);
  if (positional.length > 1) throw new CampaignUsageError(`Give exactly one campaign. ${USAGE}`);
  const slug = positional[0]!;
  if (!SLUG_PATTERN.test(slug)) {
    throw new CampaignUsageError(`Invalid slug "${slug}": use lowercase letters, digits and hyphens.`);
  }

  if (to !== undefined) {
    const email = parseEmail(to);
    if (!email) throw new CampaignUsageError(`--to needs a valid email address, got "${to}".`);
    // Wins over --send on purpose: a test send must never reach the list.
    return { slug, mode: "test", to: email, fromBatch: 0 };
  }
  if (fromBatch !== undefined && !send) {
    throw new CampaignUsageError("--from-batch only applies together with --send.");
  }
  return { slug, mode: send ? "send" : "dry-run", fromBatch: fromBatch ?? 0 };
}

function splitFlag(arg: string): [string, string | undefined] {
  const equals = arg.indexOf("=");
  return equals === -1 ? [arg, undefined] : [arg.slice(0, equals), arg.slice(equals + 1)];
}
