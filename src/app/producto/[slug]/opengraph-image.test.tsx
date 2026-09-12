// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductView } from "@/modules/catalog/client";
import { makeProduct } from "../../../../test/fixtures/product-view";

// The route reaches the catalogue through the module's server-only crossing
// point, so the fixture goes in there rather than at the HTTP layer: this test
// is about the CARD, not about Tiendanube.
const getProductByHandle = vi.fn<(slug: string) => Promise<ProductView | null>>();
vi.mock("@/modules/catalog", () => ({ getProductByHandle }));

// Tiendanube's CDN is not reachable from a test run, and should not be: the
// point is that the route pulls the bytes ITSELF, so the fetch is the seam.
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function photoResponse(): Response {
  // A 1x1 PNG. Satori only has to decode it, not admire it.
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return new Response(pixel, { headers: { "content-type": "image/png" } });
}

async function render(slug = "musculosa-demon"): Promise<Buffer> {
  const { default: OpenGraphImage } = await import("./opengraph-image");
  const response = await OpenGraphImage({ params: Promise.resolve({ slug }) });

  return Buffer.from(await response.arrayBuffer());
}

describe("the product share card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductByHandle.mockResolvedValue(makeProduct());
    fetchMock.mockResolvedValue(photoResponse());
  });

  it("answers in PNG bytes, the content type its own metadata promises", async () => {
    const png = await render();

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  it("pulls the garment photo itself instead of leaving the fetch to satori", async () => {
    getProductByHandle.mockResolvedValue(
      makeProduct({
        images: [
          { id: 301, src: "https://cdn.example/1.png", position: 1 },
          { id: 302, src: "https://cdn.example/2.png", position: 2 },
        ],
      }),
    );

    await render();

    // The cover, and only the cover: a share card draws one photograph.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.example/1.png",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  // The whole reason the fetch lives in the route rather than inside
  // `ImageResponse`: the stream is consumed after the route returns, so a
  // throw in there would reach the crawler as a 500 with no card at all.
  it("still draws a card when the photo CDN refuses", async () => {
    fetchMock.mockResolvedValue(new Response("gone", { status: 404 }));

    const png = await render();

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("still draws a card when the photo CDN never answers", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));

    const png = await render();

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("draws the bare plate for a garment with no photographs", async () => {
    getProductByHandle.mockResolvedValue(makeProduct({ images: [] }));

    const png = await render();

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A handle can outlive its product — the link was already shared. The plate
  // alone still reads as FLESH.
  it("draws the bare plate for a handle the catalogue no longer has", async () => {
    getProductByHandle.mockResolvedValue(null);

    const png = await render("fantasma");

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
