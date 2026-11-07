import "server-only";
import { z } from "zod";
import { mapToProductView } from "../domain/map";
import type { ProductView } from "../domain/product";
import { ColourwayFieldSchema, ColourwayOwnerSchema, toColourwayIndex } from "./colourways";
import type { TiendanubeConfig } from "./config";
import { FitFieldSchema, toFitIndex } from "./fit";
import { PreviewFieldSchema, toPreviewIndex } from "./preview";
import type { ImageDimensions, ImageMeasurer } from "./image-dimensions";
import { ProductSchema } from "./schema";
import { SizeChartFieldSchema, toSizeChartIndex } from "./size-chart";
import type { TiendanubeProduct } from "./types";
import type { CheckoutProduct } from "./port";

const API_ORIGIN = "https://api.tiendanube.com";
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRY_WAIT_MS = 60_000;
// The catalogue is a few dozen photos, so this is about being a polite client
// of the CDN, not about throughput: a cold snapshot must not open every
// connection at once.
const IMAGE_MEASURE_CONCURRENCY = 6;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type Dependencies = {
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
  warn?: (message: string) => void;
  // Optional so the loader stays testable, and usable, without any network
  // beyond the Tiendanube API. Without it no image is measured and the
  // gallery simply uses its fallback layout.
  measureImage?: ImageMeasurer;
};

export type CatalogSnapshot = {
  // Every product that is not `hidden` — the answer to "can this be ordered
  // at all", per Tiendanube's three-state visibility rule (`visible`,
  // `unlisted`, `hidden`). PDP resolution, colourway links and checkout all
  // need THIS set, because an `unlisted` colourway variant is deliberately
  // reachable and fully purchasable via direct URL — it is only excluded
  // from discovery surfaces, not from sale.
  purchasable: ProductView[];
  // `visible`-only. Answers a MERCHANDISING question — what appears on
  // discovery surfaces (the grid, the sitemap, static-params) — which is a
  // different question from purchasability above. Conflating the two is
  // exactly the bug this split fixes: an `unlisted` product was purchasable
  // via its own PDP but invisible to the cart's catalog index, because the
  // cart was built off `listed` instead of `purchasable`.
  listed: ProductView[];
  checkout: CheckoutProduct[];
};

const OwnersEnvelopeSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  slug: z.string(),
  key: z.string(),
  value_type: z.string(),
  owner_resource: z.enum(["product", "products"]),
  owners: z.array(z.unknown()),
  has_more: z.boolean(),
  next_cursor: z.string().min(1).optional(),
});

type OwnersEnvelope = z.infer<typeof OwnersEnvelopeSchema>;
type FieldSlug = "colourway" | "fit" | "size_chart" | "preview";

const fieldTypes: Record<FieldSlug, "object" | "object[]"> = {
  colourway: "object",
  fit: "object",
  size_chart: "object[]",
  preview: "object",
};

class TiendanubeRequestError extends Error {
  constructor(resource: string, readonly status?: number) {
    super(status === undefined
      ? `Tiendanube request failed for ${resource}.`
      : `Tiendanube request failed for ${resource} with status ${status}.`);
    this.name = "TiendanubeRequestError";
  }
}

type JsonRequester = (url: URL, resource: string) => Promise<{ body: unknown; headers: Headers }>;

/** One authenticated GET with timeout and bounded retry, shared by every Tiendanube read. */
function createJsonRequester(config: TiendanubeConfig, dependencies: Dependencies): JsonRequester {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = dependencies.random ?? Math.random;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const requestJson = async (url: URL, resource: string): Promise<{ body: unknown; headers: Headers }> => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          cache: "no-store",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${config.accessToken}`,
            "user-agent": config.userAgent,
          },
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timer);
        if (attempt === MAX_ATTEMPTS) throw new TiendanubeRequestError(resource);
        await sleep(backoffMilliseconds(attempt, random));
        continue;
      }
      if (response.ok) {
        try {
          const body = await response.json();
          clearTimeout(timer);
          return { body, headers: response.headers };
        } catch {
          clearTimeout(timer);
          if (controller.signal.aborted) {
            if (attempt === MAX_ATTEMPTS) throw new TiendanubeRequestError(resource);
            await sleep(backoffMilliseconds(attempt, random));
            continue;
          }
          throw new Error(`Tiendanube contract error for ${resource}: invalid JSON.`);
        }
      }
      clearTimeout(timer);

      if (!isRetryable(response.status) || attempt === MAX_ATTEMPTS) {
        throw new TiendanubeRequestError(resource, response.status);
      }

      await sleep(retryDelay(response, attempt, random, resource));
    }

    throw new TiendanubeRequestError(resource);
  };

  return requestJson;
}

export function createTiendanubeCatalogLoader(
  config: TiendanubeConfig,
  dependencies: Dependencies = {},
): () => Promise<CatalogSnapshot> {
  const requestJson = createJsonRequester(config, dependencies);
  const warn = dependencies.warn ?? ((message) => console.warn(message));

  return async () => {
    const products = await loadProducts(config, requestJson);
    const colourwayField = await loadOwners(config, "colourway", requestJson);
    const fitField = await loadOwners(config, "fit", requestJson);
    const sizeChartField = await loadOwners(config, "size_chart", requestJson);
    // An absent definition means no product can carry the field, so "no
    // previews" is the truth and a 404 is read that way. ONLY a 404, ONLY here:
    // swallowing a transient failure would fail OPEN and make preview products
    // purchasable, so every other error stays fatal.
    const previewField = await loadOwners(config, "preview", requestJson).catch((error: unknown) => {
      if (!(error instanceof TiendanubeRequestError) || error.status !== 404) throw error;
      warn("[catalog] The preview custom field is not defined; treating every product as released.");
      return { id: "preview", namespace: "custom", slug: "preview", key: "custom/preview", value_type: "object", owner_resource: "products" as const, owners: [], has_more: false };
    });

    const validColourwayOwners = colourwayField.owners.flatMap((owner) => {
      const parsed = ColourwayOwnerSchema.safeParse(owner);
      return parsed.success ? [parsed.data] : [];
    });
    const ignoredColourways = colourwayField.owners.length - validColourwayOwners.length;
    if (ignoredColourways > 0) warn(`[catalog] Ignored ${ignoredColourways} malformed colourway owner(s).`);

    const colourways = toColourwayIndex(ColourwayFieldSchema.parse({
      ...normalisedField(colourwayField),
      owners: validColourwayOwners,
    }));
    const fits = toFitIndex(FitFieldSchema.parse(normalisedField(fitField)));
    const sizeCharts = toSizeChartIndex(SizeChartFieldSchema.parse(normalisedField(sizeChartField)));
    const previews = toPreviewIndex(PreviewFieldSchema.parse(normalisedField(previewField)));
    if (colourways.diagnostics.length > 0) warn(`[catalog] Ignored ${colourways.diagnostics.length} malformed colourway owner(s).`);
    if (fits.diagnostics.length > 0) warn(`[catalog] Ignored ${fits.diagnostics.length} malformed fit owner(s).`);
    if (sizeCharts.diagnostics.length > 0) warn(`[catalog] Ignored ${sizeCharts.diagnostics.length} malformed size-chart owner(s).`);
    if (previews.diagnostics.length > 0) warn(`[catalog] Ignored ${previews.diagnostics.length} malformed preview owner(s).`);

    const imageSizes = dependencies.measureImage
      ? await measureGalleryImages(products, dependencies.measureImage, warn)
      : new Map<number, ImageDimensions>();

    const purchasable: ProductView[] = [];
    const listed: ProductView[] = [];
    const checkout: CheckoutProduct[] = [];
    for (const product of products) {
      const view = mapToProductView(product, colourways.values.get(product.id) ?? null, {
        fit: fits.values.get(product.id) ?? null,
        sizeChart: sizeCharts.values.get(product.id) ?? null,
        preview: previews.values.get(product.id) ?? false,
      }, imageSizes);
      // Explicit rule, not an accident of the `visibility=visible,unlisted`
      // query param above: if that param is ever widened, or the API ever
      // returns a hidden product anyway, a hidden good must still never
      // become orderable.
      if (product.visibility === "hidden") continue;
      purchasable.push(view);
      if (view.preview) {
        // The checkout list is the ONLY thing `startTiendanubeCheckout` and the
        // restock notice trust: a client can post any variant id, so hiding the
        // buy button proves nothing. A variant missing from this list is
        // rejected server-side, which makes an unreleased product unbuyable
        // even though its PDP and grid card still render.
        if (product.visibility === "visible") listed.push(view);
        continue;
      }
      checkout.push({
        productId: product.id,
        variants: product.variants.map((variant, index) => ({
          productId: product.id,
          variantId: variant.id,
          price: view.variants[index]!.price,
          stockManagement: variant.stock_management,
          stock: variant.stock,
        })),
      });
      if (product.visibility === "visible") listed.push(view);
    }

    return { purchasable, listed, checkout };
  };
}

/**
 * Reads ONE product straight from Tiendanube, bypassing the cached snapshot.
 *
 * The snapshot is stale-while-revalidate (up to five minutes, and the webhook
 * only marks it stale): asked right after a product/updated delivery it would
 * still report the variant as sold out, so a restock notice would be judged
 * against the very state it was meant to replace and never sent. Only the
 * provider can say what the stock is now.
 *
 * `null` means the product is gone (404); anything else that goes wrong throws,
 * so the caller can tell "nothing to notify" from "could not find out".
 */
export function createTiendanubeProductReader(
  config: TiendanubeConfig,
  dependencies: Dependencies = {},
): (productId: number) => Promise<ProductView | null> {
  const requestJson = createJsonRequester(config, dependencies);

  return async (productId) => {
    const url = new URL(`/2025-03/${config.storeId}/products/${productId}`, API_ORIGIN);
    let body: unknown;
    try {
      ({ body } = await requestJson(url, "product"));
    } catch (error) {
      if (error instanceof TiendanubeRequestError && error.status === 404) return null;
      throw error;
    }
    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) throw new Error("Tiendanube contract error for product.");
    // No colourway, fit or size chart: a restock email needs none of them, and
    // each is a further round trip inside a three-second-sensitive path.
    return mapToProductView(parsed.data);
  };
}

/**
 * Measures every orderable product's gallery photos, a few at a time.
 *
 * A failure here must never fail the snapshot — it IS the storefront — so a
 * measurer that throws is treated the same as one that returns `null`: that
 * photo has no size, and the whole run says so in ONE warning that carries a
 * count and nothing else (no URLs, which would be noise at best).
 */
async function measureGalleryImages(
  products: TiendanubeProduct[],
  measureImage: ImageMeasurer,
  warn: (message: string) => void,
): Promise<Map<number, ImageDimensions>> {
  const pending = products
    .filter((product) => product.visibility !== "hidden")
    .flatMap((product) => product.images);
  const sizes = new Map<number, ImageDimensions>();
  let unmeasured = 0;
  let next = 0;

  const worker = async () => {
    while (next < pending.length) {
      const image = pending[next++]!;
      const size = await measureImage({ src: image.src, updatedAt: image.updated_at }).catch(() => null);
      if (size) sizes.set(image.id, size);
      else unmeasured += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMAGE_MEASURE_CONCURRENCY, pending.length) }, worker));

  if (unmeasured > 0) {
    warn(`[catalog] Could not measure ${unmeasured} gallery image(s); they use the fallback layout.`);
  }

  return sizes;
}

async function loadProducts(
  config: TiendanubeConfig,
  requestJson: (url: URL, resource: string) => Promise<{ body: unknown; headers: Headers }>,
): Promise<TiendanubeProduct[]> {
  let url = new URL(`/2025-03/${config.storeId}/products`, API_ORIGIN);
  url.searchParams.set("visibility", "visible,unlisted");
  url.searchParams.set("per_page", String(PAGE_SIZE));
  const visited = new Set<string>();
  const products: TiendanubeProduct[] = [];
  let rawCount = 0;
  let invalidCount = 0;

  for (let page = 1; ; page += 1) {
    if (page > MAX_PAGES || visited.has(url.href)) throw new Error("Tiendanube product pagination contract error.");
    visited.add(url.href);
    const response = await requestJson(url, "products");
    const rawPage = z.array(z.unknown()).safeParse(response.body);
    if (!rawPage.success) throw new Error("Tiendanube contract error for products.");
    rawCount += rawPage.data.length;
    for (const item of rawPage.data) {
      const parsed = ProductSchema.safeParse(item);
      if (parsed.success) products.push(parsed.data);
      else invalidCount += 1;
    }

    const next = nextProductUrl(response.headers.get("link"), config.storeId);
    if (!next) break;
    url = next;
  }

  if (rawCount > 0 && products.length === 0) {
    throw new Error("Tiendanube contract error: a non-empty response yielded zero valid products.");
  }
  if (invalidCount > 0) {
    throw new Error("Tiendanube contract error: malformed required product payload.");
  }
  const productIds = new Set(products.map((product) => product.id));
  if (productIds.size !== products.length) {
    throw new Error("Tiendanube product pagination contract error: duplicate product identifiers.");
  }
  return products;
}

async function loadOwners(
  config: TiendanubeConfig,
  slug: FieldSlug,
  requestJson: (url: URL, resource: string) => Promise<{ body: unknown; headers: Headers }>,
): Promise<OwnersEnvelope> {
  let cursor: string | undefined;
  const visited = new Set<string>();
  let first: OwnersEnvelope | undefined;
  const owners: unknown[] = [];

  for (let page = 1; ; page += 1) {
    if (page > MAX_PAGES) throw new Error(`Tiendanube cursor pagination contract error for ${slug}.`);
    const url = new URL(`/unstable/${config.storeId}/products/custom-fields/custom/${slug}/owners`, API_ORIGIN);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor !== undefined) url.searchParams.set("after", cursor);
    const response = await requestJson(url, `custom field ${slug}`);
    const parsed = OwnersEnvelopeSchema.safeParse(response.body);
    if (!parsed.success) throw new Error(`Tiendanube contract error for custom field ${slug}.`);
    assertFieldIdentity(parsed.data, slug);
    if (first) assertSameDefinition(first, parsed.data, slug);
    else first = parsed.data;
    owners.push(...parsed.data.owners);

    if (!parsed.data.has_more) return { ...first, owners, has_more: false };
    const next = parsed.data.next_cursor;
    if (!next || visited.has(next)) throw new Error(`Tiendanube cursor pagination contract error for ${slug}.`);
    visited.add(next);
    cursor = next;
  }
}

function assertFieldIdentity(field: OwnersEnvelope, slug: FieldSlug): void {
  const validKey = field.key === slug || field.key === `custom/${slug}`;
  if (field.namespace !== "custom" || field.slug !== slug || !validKey || field.value_type !== fieldTypes[slug]) {
    throw new Error(`Tiendanube custom-field definition contract error for ${slug}.`);
  }
}

function assertSameDefinition(first: OwnersEnvelope, next: OwnersEnvelope, slug: string): void {
  const fields: (keyof OwnersEnvelope)[] = ["id", "namespace", "slug", "key", "value_type", "owner_resource"];
  if (fields.some((field) => first[field] !== next[field])) {
    throw new Error(`Tiendanube custom-field definition changed during pagination for ${slug}.`);
  }
}

function normalisedField(field: OwnersEnvelope) {
  return { ...field, owner_resource: "product" as const, has_more: false };
}

function nextProductUrl(link: string | null, storeId: string): URL | null {
  if (!link) return null;
  const links = link.matchAll(/<([^>]+)>\s*;\s*rel="?([^";,]+)"?/g);
  for (const match of links) {
    if (match[2] !== "next") continue;
    let next: URL;
    try {
      next = new URL(match[1]!);
    } catch {
      throw new Error("Tiendanube product pagination contract error.");
    }
    const expectedPath = `/2025-03/${storeId}/products`;
    if (
      next.protocol !== "https:" ||
      next.origin !== API_ORIGIN ||
      next.pathname !== expectedPath ||
      next.searchParams.get("visibility") !== "visible,unlisted" ||
      next.searchParams.get("per_page") !== String(PAGE_SIZE) ||
      next.username ||
      next.password ||
      next.hash
    ) {
      throw new Error("Tiendanube product pagination contract error.");
    }
    return next;
  }
  return null;
}

function isRetryable(status: number): boolean {
  return status === 429 || [500, 502, 503, 504].includes(status);
}

function retryDelay(
  response: Response,
  attempt: number,
  random: () => number,
  resource: string,
): number {
  const retryAfter = retryAfterMilliseconds(response.headers.get("retry-after"));
  const rateLimitReset = response.status === 429
    ? positiveNumber(response.headers.get("x-rate-limit-reset"))
    : null;
  const instructedDelay = Math.max(retryAfter ?? 0, rateLimitReset ?? 0);
  if (instructedDelay > MAX_RETRY_WAIT_MS) {
    throw new Error(`Tiendanube retry-wait budget exceeded for ${resource}.`);
  }
  const baseDelay = instructedDelay > 0
    ? instructedDelay
    : backoffMilliseconds(attempt, () => 0);
  const jitter = Math.min(
    Math.floor(random() * 100),
    MAX_RETRY_WAIT_MS - baseDelay,
  );
  return baseDelay + jitter;
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function positiveNumber(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function backoffMilliseconds(attempt: number, random: () => number): number {
  return 250 * 2 ** (attempt - 1) + Math.floor(random() * 100);
}



