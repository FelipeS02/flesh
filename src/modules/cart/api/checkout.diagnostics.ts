import "server-only";
import { TiendanubeCheckoutError, type CheckoutFailureDetail } from "./checkout.tiendanube";

/**
 * Failing silently towards the SHOPPER and failing silently towards the
 * OPERATOR are two different decisions, and this module exists because they
 * were once the same one: every refusal collapsed into an identical
 * `unavailable()` with nothing written anywhere, so a real outage could not be
 * told apart from a rate limit or a missing env var.
 *
 * What it must never do is buy that visibility with a leak. The access token
 * has been observed travelling inside upstream messages (see the adapter's
 * "socket with secret-token" test), so a cause is never attached and a message
 * is never copied — only discriminants the adapter chose deliberately.
 */
export function logCheckoutFailure(input: unknown): void {
  console.error("[checkout] unavailable", describeCheckoutFailure(input));
}

/** Reduces anything thrown or refused into a sanitized, loggable discriminant. */
export function describeCheckoutFailure(input: unknown): CheckoutFailureDetail {
  if (input instanceof TiendanubeCheckoutError) return input.detail;
  if (typeof input === "object" && input !== null && "reason" in input) return input as CheckoutFailureDetail;
  // The config is read inside the same try that swallows everything, so a
  // missing env var surfaces here as a ZodError and nothing else. The
  // constructor name is the whole clue, and unlike a message it cannot carry a
  // value the operator is not allowed to see.
  return { reason: "unexpected_error", errorName: constructorNameOf(input) };
}

function constructorNameOf(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return Object.getPrototypeOf(value)?.constructor?.name ?? "Object";
}
