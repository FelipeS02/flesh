import { z } from "zod";

// 254 is the RFC 5321 path limit; anything longer cannot be a deliverable
// address, and an unbounded string would be written to the database as-is.
const EmailSchema = z.string().trim().max(254).pipe(z.email());

/**
 * The address as the person typed it (minus surrounding whitespace), or null.
 *
 * The case is deliberately NOT normalised: `newsletter_subscribers.email` and
 * `restock_requests.email` are `citext`, so the database already treats
 * `Ana@x.com` and `ana@x.com` as one address. Lowercasing here would add a
 * second, silent source of truth and rewrite what the person actually typed.
 */
export function parseEmail(input: unknown): string | null {
  const parsed = EmailSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
