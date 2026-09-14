import type { CheckoutBuyer } from "../domain/line";

/**
 * Fixed at exactly three bullets per name part (spec A1) — one bullet per
 * remaining letter would leak the name's length, narrowing the candidate set
 * for a feature whose whole point is not exposing identity.
 */
const BULLETS = "•••";

/** `Array.from` takes the first character as a whole codepoint, so an accented or astral first letter is never split mid-codepoint. */
export function maskBuyerLabel(buyer: CheckoutBuyer): string {
  return `${maskPart(buyer.firstName)} ${maskPart(buyer.lastName)}`;
}

function maskPart(name: string): string {
  const first = Array.from(name.trim())[0] ?? "";
  return `${first.toLocaleUpperCase("es")}${BULLETS}`;
}
