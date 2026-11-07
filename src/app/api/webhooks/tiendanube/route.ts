import { after } from "next/server";
import { handleCatalogWebhook } from "@/modules/catalog";
import { dispatchRestockNotices } from "@/modules/newsletter";

/**
 * Public boundary for Tiendanube's `product/updated` deliveries. Signature
 * verification and cache invalidation belong to the catalog module; this file
 * is the composition root that also lets the newsletter module react.
 *
 * The wiring lives here, not inside either module, so the dependency points
 * outward from `app/` into both: catalog stays unaware that anyone listens to
 * it, and newsletter (which already reads the catalog) never has to be
 * imported by it.
 */
export function POST(request: Request): Promise<Response> {
  return handleCatalogWebhook(request, {
    // `after()` runs once the 204 is sent: the provider drops a delivery that
    // takes longer than three seconds, and the dispatch reads Tiendanube and
    // mails in batches.
    onProductUpdated: (productId) => after(() => dispatchRestockNotices(productId)),
  });
}
