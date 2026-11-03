import { z } from "zod";

const ConfigSchema = z.object({
  RESEND_API_KEY: z.string().trim().min(1),
  EMAIL_FROM: z.string().trim().min(1),
  // A blank value in a hosting dashboard is "unset", not "invalid".
  EMAIL_REPLY_TO: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
});

export type MailConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

export function readMailConfig(
  environment: Record<string, string | undefined> = process.env,
): MailConfig {
  const parsed = ConfigSchema.safeParse(environment);
  if (!parsed.success) {
    // Names only, never values: the API key must not reach a log line.
    const variables = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
      .sort()
      .join(", ");
    throw new Error(`Invalid mail configuration: ${variables}.`);
  }

  return {
    apiKey: parsed.data.RESEND_API_KEY,
    from: parsed.data.EMAIL_FROM,
    replyTo: parsed.data.EMAIL_REPLY_TO,
  };
}
