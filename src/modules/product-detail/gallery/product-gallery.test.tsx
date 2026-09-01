import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../test/fixtures/viewport";
import { ProductGallery } from "./product-gallery";

/**
 * Deliberately shuffled: `position` is the wire's ordering field, and the
 * array order it happens to arrive in is not a contract.
 */
const FIVE_IMAGES: ImageView[] = [
  { id: 303, src: "/products/c.png", position: 3 },
  { id: 301, src: "/products/a.png", position: 1 },
  { id: 305, src: "/products/e.png", position: 5 },
  { id: 302, src: "/products/b.png", position: 2 },
  { id: 304, src: "/products/d.png", position: 4 },
];

const TITLE = "Musculosa Demon Wash Black";

function slideImages(container: HTMLElement): HTMLImageElement[] {
  return Array.from(
    container.querySelectorAll<HTMLImageElement>('[data-slot="carousel-item"] img'),
  );
}

function thumbnails(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /imagen \d+ de \d+/i });
}

describe("ProductGallery", () => {
  it("renders one slide per image, ordered by position", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    const sources = slideImages(container).map((image) =>
      decodeURIComponent(image.getAttribute("src") ?? ""),
    );

    expect(sources).toHaveLength(5);
    expect(sources.map((src) => /\/([a-e])\.png/.exec(src)?.[1])).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("marks the first thumbnail active and dims the rest", () => {
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    const [first, ...rest] = thumbnails();

    expect(first!.getAttribute("aria-pressed")).toBe("true");
    expect(first!.className).toContain("border-foreground");

    for (const thumb of rest) {
      expect(thumb.getAttribute("aria-pressed")).toBe("false");
      expect(thumb.className).toContain("opacity-50");
    }
  });

  it("selects a slide when its thumbnail is activated", () => {
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    fireEvent.click(thumbnails()[2]!);

    expect(thumbnails()[2]!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("counts the selected image on mobile, and follows the selection", () => {
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    expect(screen.getByText("1 / 5")).not.toBeNull();

    fireEvent.click(thumbnails()[3]!);

    expect(screen.getByText("4 / 5")).not.toBeNull();
  });

  // Nothing re-renders the gallery on a resize in production, so this drives
  // the viewport change alone: it proves the subscription, not a lucky
  // re-read during some other render.
  it("scrolls vertically on desktop and horizontally on mobile", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    const orientation = () =>
      container
        .querySelector("[data-gallery-stage]")
        ?.getAttribute("data-orientation");

    expect(orientation()).toBe("horizontal");

    act(() => setViewport("desktop"));

    expect(orientation()).toBe("vertical");
  });

  it("renders neither a rail nor a counter for a single-image product", () => {
    const { container } = render(
      <ProductGallery images={[FIVE_IMAGES[1]!]} title={TITLE} />,
    );

    expect(slideImages(container)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /imagen \d+ de \d+/i })).toBeNull();
    expect(screen.queryByText(/^\d+ \/ \d+$/)).toBeNull();
  });
});
