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

  it("opens the graph with the first image by position, not by array order", () => {
    const metadata = productMetadata(
      makeProduct({
        images: [
          { id: 302, src: "/products/2.png", position: 2 },
          { id: 301, src: "/products/1.png", position: 1 },
        ],
      }),
    );

    expect(metadata.openGraph?.images).toEqual([{ url: "/products/1.png" }]);
  });

  it("opens the graph on the canonical URL, so a share resolves to one page", () => {
    const metadata = productMetadata(makeProduct({ slug: "musculosa-demon" }));

    expect(metadata.openGraph?.url).toBe("/producto/musculosa-demon");
  });

  it("declares no openGraph image for a product that has none", () => {
    const metadata = productMetadata(makeProduct({ images: [] }));

    expect(metadata.openGraph?.images).toBeUndefined();
  });
});
