import { z } from "zod";

const ConfigSchema = z.object({
  TIENDANUBE_STORE_ID: z.string().regex(/^\d+$/),
  TIENDANUBE_ACCESS_TOKEN: z.string().trim().min(1),
  TIENDANUBE_USER_AGENT: z.string().trim().min(1),
});

export type TiendanubeConfig = {
  storeId: string;
  accessToken: string;
  userAgent: string;
};

export function readTiendanubeConfig(
  environment: Record<string, string | undefined> = process.env,
): TiendanubeConfig {
  const parsed = ConfigSchema.safeParse(environment);
  if (!parsed.success) {
    const variables = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
      .sort()
      .join(", ");
    throw new Error(`Invalid Tiendanube configuration: ${variables}.`);
  }

  return {
    storeId: parsed.data.TIENDANUBE_STORE_ID,
    accessToken: parsed.data.TIENDANUBE_ACCESS_TOKEN,
    userAgent: parsed.data.TIENDANUBE_USER_AGENT,
  };
}
