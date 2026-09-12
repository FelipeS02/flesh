import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../test/fixtures/viewport";
import { ProductGallery } from "./product-gallery";
import { MAX_BLUR_PX } from "./slide-blur";

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

function slideFilters(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
  ).map((slide) => slide.style.filter);
}

const NO_BLUR = Array<string>(5).fill("");

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

  // How the blur behaves *between* snaps is `slide-blur.test.ts`'s job —
  // jsdom has no layout for embla to scroll through. What this proves is the
  // wiring: the effect found the slide nodes and wrote a filter onto them.
  it("blurs every slide that is not the resting one, on desktop", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    act(() => setViewport("desktop"));

    // The resting slide carries NO filter at all — an empty string, not
    // `blur(0px)`. A zero-radius filter still promotes the photo to its own
    // composited layer, which is what left a parked slide looking soft.
    expect(slideFilters(container)).toEqual([
      "",
      ...Array<string>(4).fill(`blur(${MAX_BLUR_PX}px)`),
    ]);
  });

  // A phone pays for `filter: blur()` on a full-bleed photograph in the one
  // currency the gallery cannot spend: a swipe that stutters behind the thumb
  // dragging it.
  //
  // The second half is the part worth proving. The effect CLEARS rather than
  // merely skipping, so a window narrowed across the breakpoint takes the
  // filter back off — skipping alone would leave whatever was painted last
  // frozen onto the slides, with no listener still running to remove it.
  it("draws no blur on mobile, and strips one left over from desktop", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    expect(slideFilters(container)).toEqual(NO_BLUR);

    act(() => setViewport("desktop"));
    expect(slideFilters(container)).not.toEqual(NO_BLUR);

    act(() => setViewport("mobile"));
    expect(slideFilters(container)).toEqual(NO_BLUR);
  });

  // The thumbnail rail is a SIBLING of the stage, so a viewport budget spent
  // entirely on the photograph does not squeeze the rail — it pushes it BELOW
  // the fold, under the fixed purchase widget, where it cannot be reached.
  // The column owns the budget and the stage takes what is left of it.
  //
  // jsdom computes no layout, so the classes are the only observable thing
  // here; what they pin is WHICH box carries the measurement.
  it("budgets the viewport on the column, not on the photograph", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    const stage = container.querySelector("[data-gallery-stage]");

    expect(stage?.parentElement?.className).toContain("--pdp-widget-height");
    expect(stage?.className).not.toContain("--pdp-widget-height");
    expect(stage?.className).toContain("flex-1");
    expect(stage?.className).toContain("min-h-0");
  });

  // The PDP wraps its content in a 16px gutter (`px-4`). The photos are
  // full-bleed studio shots, so honouring that gutter left the page
  // background showing as two strips down the sides and read as a crop.
  // Both halves matter: the negative margin alone would shift the stage
  // without widening it.
  it("breaks the stage out of the page gutter on mobile, and only on mobile", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    const stage = container.querySelector("[data-gallery-stage]");

    expect(stage?.className).toContain("-mx-4");
    expect(stage?.className).toContain("w-[calc(100%+2rem)]");
    expect(stage?.className).toContain("md:mx-0");
    expect(stage?.className).toContain("md:w-full");
  });

  // The stage gave up the gutter; the overlays carry it instead, so neither
  // ends up flush against the screen edge.
  it("keeps the badge and the counter clear of the screen edge on mobile", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} badge={<span>NEW</span>} />,
    );

    expect(container.querySelector("[data-gallery-badge]")?.className).toContain(
      "left-7",
    );
    expect(screen.getByText("1 / 5").className).toContain("right-6");
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
