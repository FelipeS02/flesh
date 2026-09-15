// Edge-safe by construction: the proxy that verifies this token runs on the
// Edge runtime (see `src/proxy.ts`), where `node:crypto` does not exist.
// Web Crypto (`crypto.subtle`) is the only signing primitive available there,
// so it is used here too even though this module also runs from the Node
// server action that signs the token.

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Token shape: `"<exp>.<hex hmac of exp>"` — the expiry rides in the clear, the HMAC only proves it was not altered. */
export async function signToken(expiresAt: number, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiresAt)));
  return `${expiresAt}.${toHex(signature)}`;
}

const TOKEN_PATTERN = /^(\d+)\.([0-9a-f]+)$/;

/**
 * Rejects malformed, tampered, and expired tokens. Re-signs the claimed
 * expiry and compares in constant time rather than parsing-and-trusting the
 * submitted signature — the only way an HMAC check earns its name.
 */
export async function verifyToken(token: string, secret: string, now: number): Promise<boolean> {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;

  const [, expiresAtRaw, signature] = match;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = await signToken(expiresAt, secret);
  const expectedSignature = expected.slice(expected.indexOf(".") + 1);

  return constantTimeEqual(signature, expectedSignature);
}

/**
 * A short-circuiting `===` (or an early `return false` on length mismatch)
 * leaks the compared value's length and matching prefix through timing —
 * this loops over the full max length every time so no branch of the
 * comparison finishes early. Used for both the HMAC signature and the
 * submitted password.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return diff === 0;
}
