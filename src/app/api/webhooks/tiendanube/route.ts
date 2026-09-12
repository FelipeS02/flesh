import { handleCatalogWebhook } from "@/modules/catalog";

/**
 * Public boundary for Tiendanube's `product/updated` deliveries. Signature
 * verification and cache invalidation belong to the catalog module, so this
 * file stays thin enough to hold no decision of its own.
 */
export function POST(request: Request): Promise<Response> {
  return handleCatalogWebhook(request);
}
