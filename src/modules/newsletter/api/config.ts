import { z } from "zod";

const ConfigSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
});

export type SupabaseConfig = {
  url: string;
  secretKey: string;
};

export function readSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): SupabaseConfig {
  const parsed = ConfigSchema.safeParse(environment);
  if (!parsed.success) {
    // Names only, never values: the secret key must not reach a log line.
    const variables = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
      .sort()
      .join(", ");
    throw new Error(`Invalid Supabase configuration: ${variables}.`);
  }

  return { url: parsed.data.SUPABASE_URL, secretKey: parsed.data.SUPABASE_SECRET_KEY };
}
