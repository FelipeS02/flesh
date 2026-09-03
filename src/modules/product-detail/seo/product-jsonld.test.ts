import { describe, expect, it } from "vitest";
import type { ProductView, SafeHtml } from "@/modules/catalog/client";
import { makeProduct, makeVariant } from "../../../../test/fixtures/product-view";
import { productJsonLd, serializeJsonLd } from "./product-jsonld";

const BASE = new URL("https://flesh.com.ar");

/**
 * One colourway sold in two sizes. Colours are separate PRODUCTS, so this is
 * the shape the offer rule has to hold on: one offer for the garment, and a
 * size axis it must NOT split into offers of its own.
 */
function oneColourway(overrides: Partial<ProductView> = {}): ProductView {
  return makeProduct({
    slug: "musculosa-demon",
    axes: [{ index: 0, label: "Talle", values: ["M", "S"] }],
    colourway: { group: "musculosa-demon", hex: "#0A0A0A", name: "Noir" },
    variants: [
      makeVariant({ id: 201, combination: ["M"], price: money(2_700_000) }),
      makeVariant({ id: 202, combination: ["S"], price: money(3_000_000) }),
    ],
    ...overrides,
  });
}

function money(amount: number) {
  return { amount, currency: "ARS" };
}

describe("productJsonLd", () => {
  it("declares a schema.org Product", () => {
    const jsonLd = productJsonLd(makeProduct({ title: "Musculosa Demon" }), BASE);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("Musculosa Demon");
  });

  it("describes the product as text, never as markup", () => {
    const jsonLd = productJsonLd(
      makeProduct({ descriptionHtml: "<p>Base <em>negra</em>.</p>" as SafeHtml }),
      BASE,
    );

    expect(jsonLd.description).toBe("Base negra.");
  });

  it("resolves the images against the site URL, because crawlers get no base", () => {
    const jsonLd = productJsonLd(
      makeProduct({
        images: [
          { id: 302, src: "/products/2.png", position: 2 },
          { id: 301, src: "/products/1.png", position: 1 },
        ],
      }),
      BASE,
    );

    expect(jsonLd.image).toEqual([
      "https://flesh.com.ar/products/1.png",
      "https://flesh.com.ar/products/2.png",
    ]);
  });

  it("leaves an already-absolute image URL alone", () => {
    const jsonLd = productJsonLd(
      makeProduct({
        images: [{ id: 301, src: "https://cdn.tiendanube.com/1.png", position: 1 }],
      }),
      BASE,
    );

    expect(jsonLd.image).toEqual(["https://cdn.tiendanube.com/1.png"]);
  });

  it("addresses the product at its absolute canonical URL", () => {
    const jsonLd = productJsonLd(makeProduct({ slug: "musculosa-demon" }), BASE);

    expect(jsonLd.url).toBe("https://flesh.com.ar/producto/musculosa-demon");
  });

  it("emits ONE offer for the garment, not one per size", () => {
    const jsonLd = productJsonLd(oneColourway(), BASE);

    expect(jsonLd.offers).toHaveLength(1);
    expect(jsonLd.offers[0]!.name).toBe("Noir");
  });

  it("prices the garment at its cheapest size, in major units", () => {
    const jsonLd = productJsonLd(oneColourway(), BASE);

    expect(jsonLd.offers[0]).toMatchObject({
      "@type": "Offer",
      price: "27000.00",
      priceCurrency: "ARS",
    });
  });

  it("keeps the offer on the canonical URL, since the variants share it", () => {
    const jsonLd = productJsonLd(oneColourway(), BASE);

    expect(jsonLd.offers[0]!.url).toBe(
      "https://flesh.com.ar/producto/musculosa-demon",
    );
  });

  it("marks the garment in stock when any of its sizes is", () => {
    const jsonLd = productJsonLd(
      oneColourway({
        variants: [
          makeVariant({ id: 201, combination: ["M"], price: money(2_700_000), inStock: false }),
          makeVariant({ id: 202, combination: ["S"], price: money(2_700_000), inStock: true }),
        ],
      }),
      BASE,
    );

    expect(jsonLd.offers[0]!.availability).toBe("https://schema.org/InStock");
  });

  it("marks it out of stock only when every size is gone", () => {
    const jsonLd = productJsonLd(
      oneColourway({
        variants: [
          makeVariant({ id: 201, combination: ["M"], price: money(2_700_000), inStock: false }),
          makeVariant({ id: 202, combination: ["S"], price: money(2_700_000), inStock: false }),
        ],
      }),
      BASE,
    );

    expect(jsonLd.offers[0]!.availability).toBe("https://schema.org/OutOfStock");
  });

  it("emits a single unnamed offer for a garment in no colour group", () => {
    const jsonLd = productJsonLd(
      makeProduct({
        axes: [{ index: 0, label: "Talle", values: ["M", "S"] }],
        variants: [
          makeVariant({ combination: ["M"], price: money(3_100_000) }),
          makeVariant({ combination: ["S"], price: money(2_700_000) }),
        ],
      }),
      BASE,
    );

    expect(jsonLd.offers).toHaveLength(1);
    expect(jsonLd.offers[0]).toMatchObject({ price: "27000.00" });
    expect(jsonLd.offers[0]!.name).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("never emits a literal </script>, which merchant copy can carry", () => {
    const serialized = serializeJsonLd(
      productJsonLd(
        makeProduct({ title: "Musculosa </script><img onerror=alert(1)>" }),
        BASE,
      ),
    );

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<img");
  });

  it("still parses back to the same object after escaping", () => {
    const jsonLd = productJsonLd(makeProduct({ title: "Musculosa </script>" }), BASE);

    expect(JSON.parse(serializeJsonLd(jsonLd))).toEqual(jsonLd);
  });
});
