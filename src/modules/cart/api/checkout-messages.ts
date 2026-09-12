/**
 * The single generic, actionable failure message shown for every checkout
 * failure — service rejection, guard denial, adapter error, unsafe URL, or
 * client-side rejection alike. Kept as one literal, importable by both
 * server-only and client code (design: "Client-visible and operational
 * outcomes MUST exclude buyer PII, credentials, provider bodies, and
 * internal diagnostics"), so no layer can drift toward a differently
 * worded — or more revealing — string.
 */
export const CHECKOUT_FAILURE_REASON = "No pudimos iniciar el checkout. Intentá de nuevo.";
