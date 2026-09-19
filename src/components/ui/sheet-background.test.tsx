import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Sheet, SheetContent } from "./sheet";
import { SheetBackgroundPreload } from "./sheet-background";

function preloadLink(): HTMLLinkElement {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="preload"][as="image"]',
  );

  if (!link) throw new Error("Expected the sheet background preload link");

  return link;
}

function backgroundImage(): HTMLImageElement {
  const image = document.querySelector<HTMLImageElement>('img[alt="background"]');

  if (!image) throw new Error("Expected the sheet's decorative background");

  return image;
}

describe("SheetBackgroundPreload", () => {
  // The whole point of the preload, and the only thing that can silently
  // undo it. A link that resolves to a different candidate than the `<img>`
  // still "works" — it downloads, the page still renders — it just warms a
  // resource nobody asks for, and the drawer opens on an empty panel exactly
  // as it did before. Comparing the two rendered attributes is what proves
  // the browser has one decision to make here, not two.
  it("offers the browser the same candidates the drawer's background requests", () => {
    render(
      <>
        <SheetBackgroundPreload />
        <Sheet open>
          <SheetContent styledBackground />
        </Sheet>
      </>,
    );

    const link = preloadLink();
    const image = backgroundImage();

    expect(link.getAttribute("imagesrcset")).toBe(image.getAttribute("srcset"));
    expect(link.getAttribute("imagesizes")).toBe(image.getAttribute("sizes"));
  });

  // Guards the reason this is a srcset and not an `href`: the raw imported
  // file is NOT what the page requests once `next.config.ts` has an optimizer
  // and an AVIF preference, and preloading it was the original bug.
  it("preloads optimizer URLs rather than the imported asset", () => {
    render(<SheetBackgroundPreload />);

    const srcSet = preloadLink().getAttribute("imagesrcset") ?? "";

    expect(srcSet).toContain("/_next/image");
    expect(srcSet.split(",").length).toBeGreaterThan(1);
  });
});
