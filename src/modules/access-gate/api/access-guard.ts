import "server-only";
import { cookies } from "next/headers";
import { readAccessGateConfig } from "./config";
import { ACCESS_GATE_COOKIE_NAME } from "../domain/cookie-name";
import { verifyToken } from "../domain/session";

/**
 * The authorization boundary the proxy cannot be: Next dispatches Server
 * Actions by id, not by URL, so `src/proxy.ts`'s matcher — which excludes
 * `/acceso` — never runs for an action call reaching that path (confirmed:
 * a POST to `/acceso` carrying `readBuyerProfile`'s action id ran with no
 * gate cookie). Every gate-worthy action re-checks the session here instead
 * of trusting which page rendered it.
 */
export async function isAccessGranted(): Promise<boolean> {
  const config = readAccessGateConfig();

  // Disabled gate (no ACCESS_GATE_PASSWORD) must let everything through —
  // same deliberate rule as `proxy.ts`'s `gate()` and `unlock.action.ts`.
  if (!config.enabled) return true;

  const token = (await cookies()).get(ACCESS_GATE_COOKIE_NAME)?.value;
  return token ? await verifyToken(token, config.secret, Date.now()) : false;
}
