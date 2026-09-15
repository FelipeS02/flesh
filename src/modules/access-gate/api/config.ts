import { z } from "zod";

const ConfigSchema = z.object({
  ACCESS_GATE_PASSWORD: z.string().optional(),
  ACCESS_GATE_SECRET: z.string().trim().min(1).optional(),
  ACCESS_GATE_MESSAGE: z.string().optional(),
});

const DEFAULT_MESSAGE = "SITIO EN **CONSTRUCCIÓN**";

export type AccessGateConfig =
  | { enabled: false }
  | { enabled: true; password: string; secret: string; message: string };

/**
 * Runs on the Edge proxy on every request, so a thrown "invalid config"
 * error here would take the whole store down — only the operator-error case
 * (a password with no secret to sign against) throws. An unset or empty
 * password is a deliberate, silent disable, never a fatal misconfiguration.
 */
export function readAccessGateConfig(
  environment: Record<string, string | undefined> = process.env,
): AccessGateConfig {
  const parsed = ConfigSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error("Invalid access gate configuration.");
  }

  const password = parsed.data.ACCESS_GATE_PASSWORD?.trim();
  if (!password) {
    return { enabled: false };
  }

  const secret = parsed.data.ACCESS_GATE_SECRET;
  if (!secret) {
    throw new Error("ACCESS_GATE_SECRET is required when ACCESS_GATE_PASSWORD is set.");
  }

  return {
    enabled: true,
    password,
    secret,
    message: parsed.data.ACCESS_GATE_MESSAGE?.trim() || DEFAULT_MESSAGE,
  };
}
