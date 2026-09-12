import { describe, expect, it } from "vitest";
import type { SafeHtml } from "@/modules/catalog/client";
import { makeProduct } from "../../../../test/fixtures/product-view";
import { productMetadata } from "./product-metadata";

describe("productMetadata", () => {
  it("titles the page with the garment's name", () => {
    const metadata = productMetadata(makeProduct({ title: "Musculosa Demon" }));

    expect(metadata.title).toBe("Musculosa Demon");
  });

  it("describes the page with the description's text, never its markup", () => {
    const metadata = productMetadata(
      makeProduct({
        descriptionHtml: "<p>Base <strong>negra</strong>, arte crudo.</p>" as SafeHtml,
      }),
    );

    expect(metadata.description).toBe("Base negra, arte crudo.");
  });

  it("decodes the entities the sanitiser escaped", () => {
    const metadata = productMetadata(
      makeProduct({ descriptionHtml: "<p>Negro &amp; hueso</p>" as SafeHtml }),
    );

    expect(metadata.description).toBe("Negro & hueso");
  });

  it("collapses the whitespace block markup leaves behind", () => {
    const metadata = productMetadata(
      makeProduct({
        descriptionHtml: "<p>Base negra</p>\n\n  <p>arte crudo</p>" as SafeHtml,
      }),
    );

    expect(metadata.description).toBe("Base negra arte crudo");
  });

  it("truncates a long description on a word boundary", () => {
    const metadata = productMetadata(
      makeProduct({
        descriptionHtml: `<p>${"palabra ".repeat(60).trim()}</p>` as SafeHtml,
      }),
    );

    const description = metadata.description!;
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/palabra…$/);
  });

  it("leaves the description out entirely when the garment has no copy", () => {
    const metadata = productMetadata(
      makeProduct({ descriptionHtml: "<p>  </p>" as SafeHtml }),
    );

    expect(metadata.description).toBeUndefined();
  });

  it("points the canonical at the bare product URL, without the variant query", () => {
    const metadata = productMetadata(makeProduct({ slug: "musculosa-demon" }));

    expect(metadata.alternates?.canonical).toBe("/producto/musculosa-demon");
  });

  // Next resolves the `opengraph-image.tsx` route's own tags only when the
  // metadata at this level declares no `images` of its own — see
  // `next/dist/lib/metadata/resolve-metadata.js`. Declaring one here would buy
  // a single `og:image` URL at the cost of the `width`, `height`, `type` and
  // `alt` tags the route hands over for free.
  it("declares no images, so the opengraph-image route's own tags survive", () => {
    const metadata = productMetadata(makeProduct({ slug: "musculosa-demon" }));

    expect(metadata.openGraph).not.toHaveProperty("images");
  });

  it("opens the graph on the canonical URL, so a share resolves to one page", () => {
    const metadata = productMetadata(makeProduct({ slug: "musculosa-demon" }));

    expect(metadata.openGraph?.url).toBe("/producto/musculosa-demon");
  });
});
