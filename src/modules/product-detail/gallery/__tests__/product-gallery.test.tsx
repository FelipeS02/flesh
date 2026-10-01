import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { ProductGallery } from "../product-gallery";
import { MAX_BLUR_PX } from "../slide-blur";

// A getter, not a value: the config is read at render time, so each test can
// pick the snap flag without re-importing the module graph.
const config = vi.hoisted(() => ({ snap: false, underHeader: false, peek: 0.2 }));

vi.mock("../gallery-config", () => ({
  // Not the depth the maths is tested with, so these assertions prove the
  // component reads the tunable knob.
  DESKTOP_EDGE_FADE_STOP: 96,
  get DESKTOP_SCROLL_SNAP() {
    return config.snap;
  },
  get DESKTOP_NEXT_SLIDE_PEEK() {
    return config.peek;
  },
  get DESKTOP_GALLERY_UNDER_HEADER() {
    return config.underHeader;
  },
}));

const IMAGES: ImageView[] = [1, 2, 3, 4, 5].map((id) => ({
  id,
  src: `/products/${id}.png`,
  position: id,
}));

const TITLE = "Musculosa Demon Wash Black";
const SLIDE_HEIGHT = 722;

const frames: FrameRequestCallback[] = [];

function viewport(container: HTMLElement): HTMLDivElement {
  const node = container.querySelector<HTMLDivElement>('[data-gallery-viewport]');

  if (!node) throw new Error("Expected the gallery scroller");

  return node;
}

function slides(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-gallery-slide]'));
}

function thumbnails(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /imagen \d+ de \d+/i });
}

function stageVar(container: HTMLElement, name: string): string {
  return container
    .querySelector<HTMLElement>("[data-gallery-stage]")!
    .style.getPropertyValue(name);
}

/** Gives the viewport the geometry jsdom does not compute; returns its scrollTo spy. */
function measure(node: HTMLElement, scrollTop = 0) {
  const scrollTo = vi.fn();

  Object.defineProperty(node, "clientHeight", { configurable: true, value: SLIDE_HEIGHT });
  Object.defineProperty(node, "scrollTo", { configurable: true, value: scrollTo });
  Object.defineProperty(node, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  });

  return scrollTo;
}

function scrollViewportTo(node: HTMLElement, top: number) {
  act(() => {
    node.scrollTop = top;
    fireEvent.scroll(node);
    frames.splice(0).forEach((frame) => frame(0));
  });
}

beforeEach(() => {
  config.snap = false;
  config.underHeader = false;
  config.peek = 0.2;
  document.documentElement.style.removeProperty("--gallery-under-header-progress");
  frames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductGallery desktop scroller", () => {
  it("makes the viewport the vertical scroller on desktop, at a fixed stage height", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const classes = viewport(container).className;

    expect(classes).toContain("md:overflow-y-auto");
    expect(classes).toContain("md:overflow-x-hidden");
    expect(classes).toContain("scrollbar-none");
    // Without the header offset the box is just the visible stage, which
    // runs to the bottom of the window.
    expect(container.querySelector("[data-gallery-region]")?.className).toContain(
      "md:h-(--gallery-visible)",
    );
  });

  it("lays slides out as blocks of the slide height rather than flex-basis slots", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    for (const slide of slides(container)) {
      expect(slide.className).toContain("md:h-(--gallery-slide)");
      expect(slide.className).toContain("md:basis-auto");
    }
  });

  it("fades the top and bottom edges through independent mask properties", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const classes = container.querySelector("[data-gallery-region]")?.className ?? "";

    expect(classes).toContain("md:mask-t-from-(--gallery-mask-top,100%)");
    expect(classes).toContain("md:mask-b-from-(--gallery-mask-bottom,100%)");
    expect(classes).toContain("mask-b-from-98%");
  });

  it("snaps the desktop scroller only when the flag is on", () => {
    const off = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(viewport(off.container).className).toContain("md:snap-none");
    expect(viewport(off.container).className).not.toContain("md:snap-mandatory");
    off.unmount();

    config.snap = true;
    const on = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(viewport(on.container).className).toContain("md:snap-y");
    expect(viewport(on.container).className).toContain("md:snap-mandatory");
    expect(viewport(on.container).className).not.toContain("md:snap-none");
  });

  it("scrolls the viewport vertically when a thumbnail is chosen on desktop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const scrollTo = measure(viewport(container));

    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ top: 2 * SLIDE_HEIGHT, behavior: "smooth" });
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("confirms the selection from the vertical scroll position", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);

    scrollViewportTo(node, 3 * SLIDE_HEIGHT - 40);

    expect(thumbnails()[3]!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails()[3]!.getAttribute("aria-current")).toBe("true");
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("ignores the horizontal axis on desktop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);
    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(node, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 300,
    });

    act(() => {
      fireEvent.scroll(node);
    });

    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("blurs each slide by its distance from the scroll position, and masks both edges", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);

    scrollViewportTo(node, SLIDE_HEIGHT / 2);

    expect(slides(container).map((slide) => slide.style.filter)).toEqual([
      `blur(${MAX_BLUR_PX / 2}px)`,
      `blur(${MAX_BLUR_PX / 2}px)`,
      `blur(${MAX_BLUR_PX}px)`,
      `blur(${MAX_BLUR_PX}px)`,
      `blur(${MAX_BLUR_PX}px)`,
    ]);
    expect(stageVar(container, "--gallery-mask-top")).toBe("98%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("96%");
  });

  it("leaves a parked photo with no filter at all, and never scales or fades", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);

    // A fractional resting offset, as a browser parks a snapped scroller.
    scrollViewportTo(node, 2 * SLIDE_HEIGHT + 0.3);

    const parked = slides(container)[2]!;
    expect(parked.style.filter).toBe("");
    expect(parked.style.transform).toBe("");
    expect(parked.style.opacity).toBe("");
    expect(stageVar(container, "--gallery-mask-top")).toBe("96%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("96%");
  });

  it("has no top fade on the first slide, only the bottom one", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));

    expect(stageVar(container, "--gallery-mask-top")).toBe("100%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("96%");
  });

  it("coalesces a burst of scroll events into one paint per frame", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);
    frames.length = 0;

    fireEvent.scroll(node);
    fireEvent.scroll(node);
    fireEvent.scroll(node);

    expect(frames).toHaveLength(1);
  });

  it("takes every painted style back off when the viewport narrows", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);
    scrollViewportTo(node, SLIDE_HEIGHT / 2);

    act(() => setViewport("mobile"));

    expect(slides(container).map((slide) => slide.style.filter)).toEqual(
      Array(5).fill(""),
    );
    expect(stageVar(container, "--gallery-mask-top")).toBe("100%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("100%");
  });

  it("aligns the vertical scroller to the selection when entering desktop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(node, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 200,
    });
    fireEvent.scroll(node);
    const scrollTo = measure(node);

    act(() => setViewport("desktop"));

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 2 * SLIDE_HEIGHT,
      behavior: "auto",
    });
  });

  it("still scrolls horizontally on mobile and never paints a blur there", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    const scrollTo = vi.fn();
    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(node, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(node, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 0,
    });

    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "smooth" });
    expect(slides(container).map((slide) => slide.style.filter)).toEqual(
      Array(5).fill(""),
    );
  });
});

describe("ProductGallery running under the sticky header", () => {
  const OFFSET_VAR = "--gallery-under-header-offset";
  const PROGRESS_VAR = "--gallery-under-header-progress";
  // jsdom reports no layout, so the two heights that diverge under the header
  // are stubbed: the viewport is taller than a slide by the header offset.
  const VIEWPORT_HEIGHT = 942;

  function measureUnderHeader(container: HTMLElement, scrollTop = 0) {
    const node = viewport(container);
    const scrollTo = measure(node, scrollTop);

    Object.defineProperty(node, "clientHeight", {
      configurable: true,
      value: VIEWPORT_HEIGHT,
    });
    Object.defineProperty(slides(container)[0]!, "offsetHeight", {
      configurable: true,
      value: SLIDE_HEIGHT,
    });

    return { node, scrollTo };
  }

  function stage(container: HTMLElement) {
    return container.querySelector<HTMLElement>("[data-gallery-stage]")!;
  }

  function progress() {
    return document.documentElement.style.getPropertyValue(PROGRESS_VAR);
  }

  beforeEach(() => {
    config.underHeader = true;
  });

  it("raises only the stage, and pads the scroller by the same offset", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(stage(container).className).toContain(`md:-mt-(${OFFSET_VAR})`);
    expect(stage(container).className).toContain(OFFSET_VAR + ":calc(");
    expect(viewport(container).className).toContain(`md:pt-(${OFFSET_VAR})`);
    expect(viewport(container).className).toContain(`md:scroll-pt-(${OFFSET_VAR})`);
    expect(
      container.querySelector("[data-gallery-region]")?.className,
    ).toContain(`md:h-[calc(var(${OFFSET_VAR})+var(--gallery-visible))]`);
  });

  it("keeps the badge where it was by offsetting it with the stage", () => {
    const { container } = render(
      <ProductGallery images={IMAGES} title={TITLE} badge={<span>NEW</span>} />,
    );

    expect(
      container.querySelector("[data-gallery-badge]")?.className,
    ).toContain(`md:top-[calc(--spacing(4)+var(${OFFSET_VAR}))]`);
  });

  it("measures slides by their own height, not by the padded viewport", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { node } = measureUnderHeader(container);

    // 3 slides down is 3 * 722; divided by the 942px viewport it would read
    // as slide 2.3 and select the wrong thumbnail.
    scrollViewportTo(node, 3 * SLIDE_HEIGHT);

    expect(thumbnails()[3]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("scrolls a thumbnail jump by slide height", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { scrollTo } = measureUnderHeader(container);

    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({
      top: 2 * SLIDE_HEIGHT,
      behavior: "smooth",
    });
  });

  it("keeps the edge fade the same pixel depth on the taller viewport", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { node } = measureUnderHeader(container);

    scrollViewportTo(node, 2 * SLIDE_HEIGHT);

    // 4% of a 722px stage is 29px; the same 29px of a 942px viewport is ~3.07%.
    const depth = 100 - Number.parseFloat(stageVar(container, "--gallery-mask-bottom"));
    expect(depth).toBeCloseTo((4 * SLIDE_HEIGHT) / VIEWPORT_HEIGHT, 3);
  });

  it("publishes how far the gallery has scrolled for the header backdrop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { node } = measureUnderHeader(container);

    scrollViewportTo(node, 80);
    expect(progress()).toBe("0.5");

    scrollViewportTo(node, 400);
    expect(progress()).toBe("1");

    scrollViewportTo(node, 0);
    expect(progress()).toBe("0");
  });

  it("clears the published progress on leaving desktop and on unmount", () => {
    const { container, unmount } = render(
      <ProductGallery images={IMAGES} title={TITLE} />,
    );
    act(() => setViewport("desktop"));
    const { node } = measureUnderHeader(container);
    scrollViewportTo(node, 80);
    expect(progress()).toBe("0.5");

    act(() => setViewport("mobile"));
    expect(progress()).toBe("");

    act(() => setViewport("desktop"));
    scrollViewportTo(node, 80);
    expect(progress()).toBe("0.5");

    unmount();
    expect(progress()).toBe("");
  });

  it("does none of it with the flag off", () => {
    config.underHeader = false;
    const { container } = render(
      <ProductGallery images={IMAGES} title={TITLE} badge={<span>NEW</span>} />,
    );
    act(() => setViewport("desktop"));
    const { node } = measureUnderHeader(container);

    scrollViewportTo(node, 80);

    // The stage still DEFINES the offset (the visible height is measured
    // from it); what is off is every consumer that raises or pads with it.
    expect(stage(container).className).not.toContain("md:-mt-(");
    expect(viewport(container).className).not.toContain("md:pt-(");
    expect(viewport(container).className).not.toContain("md:scroll-pt-(");
    expect(container.querySelector("[data-gallery-badge]")?.className).not.toContain(
      OFFSET_VAR,
    );
    expect(container.querySelector("[data-gallery-region]")?.className).toContain(
      "md:h-(--gallery-visible)",
    );
    expect(progress()).toBe("");
  });
});

describe("ProductGallery peeking at the next slide", () => {
  const SLIDE = 500;
  const VIEWPORT = 900;

  function measurePeek(container: HTMLElement) {
    const node = viewport(container);
    measure(node);
    Object.defineProperty(node, "clientHeight", { configurable: true, value: VIEWPORT });
    Object.defineProperty(slides(container)[0]!, "offsetHeight", {
      configurable: true,
      value: SLIDE,
    });

    return node;
  }

  function stageStyle(container: HTMLElement, name: string) {
    return container
      .querySelector<HTMLElement>("[data-gallery-stage]")!
      .style.getPropertyValue(name);
  }

  it("publishes the peek fraction and sizes the stage down to the window bottom", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const classes = container.querySelector("[data-gallery-stage]")!.className;

    expect(stageStyle(container, "--gallery-peek")).toBe("0.2");
    // Never below today's 722px stage, so a short window cannot collapse it.
    expect(classes).toContain(
      "md:[--gallery-visible:max(--spacing(180.5),calc(100svh-var(--gallery-under-header-offset)))]",
    );
    expect(classes).toContain(
      "md:[--gallery-slide:calc(var(--gallery-visible)*(1-var(--gallery-peek,0)))]",
    );
  });

  it("snaps slides to their start, since they are shorter than the viewport", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    for (const slide of slides(container)) {
      expect(slide.className).toContain("md:snap-start");
    }
  });

  it("pads the scroller's bottom by the peek strip so the last slide can park", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(viewport(container).className).toContain("md:pb-(--gallery-peek-strip)");
    expect(
      container.querySelector("[data-gallery-stage]")!.className,
    ).toContain(
      "md:[--gallery-peek-strip:calc(var(--gallery-visible)-var(--gallery-slide))]",
    );
  });

  it("collapses to one slide per stage when the peek is zero", () => {
    config.peek = 0;
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(stageStyle(container, "--gallery-peek")).toBe("0");
  });

  it("keeps a nonsensical peek from making a slide vanish", () => {
    config.peek = 5;
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(stageStyle(container, "--gallery-peek")).toBe("0.9");
  });

  it("reaches the last slide, and turns its bottom fade off, at the last parked offset", () => {
    config.underHeader = true;
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = measurePeek(container);

    scrollViewportTo(node, 4 * SLIDE);

    expect(thumbnails()[4]!.getAttribute("aria-pressed")).toBe("true");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("100%");
    expect(slides(container)[4]!.style.filter).toBe("");
  });

  it("leaves the next slide blurred in the strip below a parked one", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = measurePeek(container);

    scrollViewportTo(node, 2 * SLIDE);

    expect(slides(container)[3]!.style.filter).toBe(`blur(${MAX_BLUR_PX}px)`);
    expect(slides(container)[2]!.style.filter).toBe("");
  });
});

describe("ProductGallery with a gap between native slides", () => {
  const SLIDE = 500;
  const GAP = 24;

  // jsdom lays nothing out, so the pitch is given the way a browser reports
  // it: as the second slide's offset from the first.
  function measureGap(container: HTMLElement) {
    const node = viewport(container);
    const scrollTo = measure(node);
    const [first, second] = slides(container);
    Object.defineProperty(first!, "offsetHeight", { configurable: true, value: SLIDE });
    Object.defineProperty(first!, "offsetTop", { configurable: true, value: 0 });
    Object.defineProperty(second!, "offsetTop", {
      configurable: true,
      value: SLIDE + GAP,
    });

    return { node, scrollTo };
  }

  it("spaces the desktop slides apart", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(slides(container)[0]!.parentElement!.className).toContain("md:gap-6");
  });

  it("scrolls a thumbnail jump by slide height plus the gap", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { scrollTo } = measureGap(container);

    fireEvent.click(thumbnails()[3]!);

    expect(scrollTo).toHaveBeenCalledWith({ top: 3 * (SLIDE + GAP), behavior: "smooth" });
  });

  it("selects and unblurs a slide parked at a multiple of the pitch", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const { node } = measureGap(container);

    scrollViewportTo(node, 4 * (SLIDE + GAP));

    expect(thumbnails()[4]!.getAttribute("aria-pressed")).toBe("true");
    expect(slides(container)[4]!.style.filter).toBe("");
  });
});

/**
 * Deliberately shuffled: `position` is the wire's ordering field, and the
 * array order it happens to arrive in is not a contract.
 */
const SHUFFLED_IMAGES: ImageView[] = [
  { id: 303, src: "/products/c.png", position: 3 },
  { id: 301, src: "/products/a.png", position: 1 },
  { id: 305, src: "/products/e.png", position: 5 },
  { id: 302, src: "/products/b.png", position: 2 },
  { id: 304, src: "/products/d.png", position: 4 },
];

function slideImages(container: HTMLElement): HTMLImageElement[] {
  return Array.from(
    container.querySelectorAll<HTMLImageElement>("[data-gallery-slide] img"),
  );
}

function slideLoading(container: HTMLElement): (string | null)[] {
  return slideImages(container).map((image) => image.getAttribute("loading"));
}

function slideFilters(container: HTMLElement): string[] {
  return slides(container).map((slide) => slide.style.filter);
}

/** Puts the horizontal scroller at slide `index`, as a swipe would. */
function swipeTo(container: HTMLElement, index: number): void {
  const node = viewport(container);

  Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(node, "scrollLeft", {
    configurable: true,
    writable: true,
    value: index * 100,
  });
  fireEvent.scroll(node);
}

describe("ProductGallery markup and mobile scroller", () => {
  it("renders one slide per image, ordered by position", () => {
    const { container } = render(<ProductGallery images={SHUFFLED_IMAGES} title={TITLE} />);

    const sources = slideImages(container).map((image) =>
      decodeURIComponent(image.getAttribute("src") ?? ""),
    );

    expect(sources.map((src) => /\/([a-e])\.png/.exec(src)?.[1])).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  // The roles `ui/carousel` used to lend for free; written out by hand now.
  it("names the carousel region and its slide positions for assistive technology", () => {
    render(<ProductGallery images={IMAGES} title={TITLE} />);

    const region = screen.getByRole("region", { name: `Galería de imágenes de ${TITLE}` });

    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(
      screen.getByRole("group", { name: "Imagen 1 de 5" }).getAttribute("aria-roledescription"),
    ).toBe("slide");
    expect(screen.getByRole("group", { name: "Imagen 5 de 5" })).not.toBeNull();
  });

  it("marks the first thumbnail active and dims the rest", () => {
    render(<ProductGallery images={IMAGES} title={TITLE} />);

    const [first, ...rest] = thumbnails();

    expect(first!.getAttribute("aria-pressed")).toBe("true");
    expect(first!.className).toContain("border-foreground");

    for (const thumb of rest) {
      expect(thumb.getAttribute("aria-pressed")).toBe("false");
      expect(thumb.className).toContain("opacity-50");
    }
  });

  it("lets native scroll geometry confirm a mobile thumbnail selection", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    const scrollTo = vi.fn();

    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(node, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(node, "scrollLeft", { configurable: true, writable: true, value: 0 });

    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "smooth" });
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    node.scrollLeft = 200;
    fireEvent.scroll(node);

    expect(thumbnails()[2]!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("clamps a mobile scroll against the CURRENT image count after the gallery shrinks", () => {
    const { container, rerender } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    rerender(<ProductGallery images={IMAGES.slice(0, 3)} title={TITLE} />);
    swipeTo(container, 4);

    const rail = thumbnails();
    expect(rail).toHaveLength(3);
    expect(rail[2]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps one scroll subscription when the image count changes", () => {
    const { container, rerender } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    const addEventListener = vi.spyOn(node, "addEventListener");
    const removeEventListener = vi.spyOn(node, "removeEventListener");

    rerender(<ProductGallery images={IMAGES.slice(0, 3)} title={TITLE} />);

    const scrollCalls = (spy: typeof addEventListener) =>
      spy.mock.calls.filter(([type]) => type === "scroll");
    expect(scrollCalls(addEventListener)).toHaveLength(0);
    expect(scrollCalls(removeEventListener)).toHaveLength(0);
  });

  it("renders thumbnails as native buttons without intercepting Enter", () => {
    render(<ProductGallery images={IMAGES} title={TITLE} />);

    const third = thumbnails()[2]!;
    third.focus();
    const enterDispatched = fireEvent.keyDown(third, { key: "Enter" });

    expect(document.activeElement).toBe(third);
    expect(third.tagName).toBe("BUTTON");
    expect(third.getAttribute("type")).toBe("button");
    expect(enterDispatched).toBe(true);
  });

  it("counts the selected image on mobile, and follows the selection", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(screen.getByText("1 / 5")).not.toBeNull();

    swipeTo(container, 3);

    expect(screen.getByText("4 / 5")).not.toBeNull();
  });

  it("observes the nearest native mobile slide without correcting a gesture", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    const scrollTo = vi.fn();

    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(node, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(node, "scrollLeft", { configurable: true, writable: true, value: 160 });

    fireEvent.scroll(node);

    expect(screen.getByText("3 / 5")).not.toBeNull();
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps a valid selection at zero width and scrolls only for thumbnail activation", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const node = viewport(container);
    const scrollTo = vi.fn();

    Object.defineProperty(node, "clientWidth", { configurable: true, value: 0 });
    Object.defineProperty(node, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(node, "scrollLeft", { configurable: true, writable: true, value: 400 });

    fireEvent.scroll(node);
    expect(screen.getByText("1 / 5")).not.toBeNull();

    Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "smooth" });
    node.scrollLeft = 200;
    fireEvent.scroll(node);
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");
  });

  it("resets selection when image identity or order changes", () => {
    const { container, rerender } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    swipeTo(container, 3);
    expect(screen.getByText("4 / 5")).not.toBeNull();

    rerender(
      <ProductGallery
        images={[...IMAGES.slice(0, 4), { id: 5, src: "/products/replaced.png", position: 5 }]}
        title={TITLE}
      />,
    );

    expect(screen.getByText("1 / 5")).not.toBeNull();
    expect(viewport(container).scrollLeft).toBe(0);
  });

  it("scrolls vertically on desktop and horizontally on mobile", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    const orientation = () =>
      container.querySelector("[data-gallery-stage]")?.getAttribute("data-orientation");

    expect(orientation()).toBe("horizontal");

    act(() => setViewport("desktop"));

    expect(orientation()).toBe("vertical");
  });

  it("preserves the shared selection through both responsive handoffs", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    swipeTo(container, 2);
    expect(screen.getByText("3 / 5")).not.toBeNull();

    act(() => setViewport("desktop"));
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");

    act(() => setViewport("mobile"));
    expect(screen.getByText("3 / 5")).not.toBeNull();
  });

  // The server paints the mobile branch (see `useMediaQuery`'s server
  // snapshot), and hydration must not tear that tree down to mount a desktop
  // one — the hero `<img>` a visitor's LCP is measured against has to survive
  // the flip.
  it("keeps the hero image as the same DOM node across the mobile-to-desktop flip", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const heroBefore = slideImages(container)[0];

    act(() => setViewport("desktop"));

    expect(slideImages(container)[0]).toBe(heroBefore);
  });

  it("keeps the same scroller element across a mobile-desktop-mobile round trip", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const before = viewport(container);

    act(() => setViewport("desktop"));
    act(() => setViewport("mobile"));
    act(() => setViewport("desktop"));

    expect(viewport(container)).toBe(before);
  });

  // A phone pays for `filter: blur()` on a full-bleed photograph in the one
  // currency the gallery cannot spend: a swipe that stutters behind the thumb.
  it("draws no blur on mobile, and strips one left over from desktop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(slideFilters(container)).toEqual(Array(5).fill(""));

    act(() => setViewport("desktop"));
    expect(slideFilters(container)).not.toEqual(Array(5).fill(""));

    act(() => setViewport("mobile"));
    expect(slideFilters(container)).toEqual(Array(5).fill(""));
  });

  // The thumbnail rail is a SIBLING of the stage, so a viewport budget spent
  // entirely on the photograph pushes it BELOW the fold. The column owns the
  // budget and the stage takes what is left. jsdom computes no layout, so the
  // classes are the only observable thing; what they pin is WHICH box carries
  // the measurement.
  it("budgets the viewport on the column, not on the photograph", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    const stage = container.querySelector("[data-gallery-stage]");

    expect(stage?.parentElement?.className).toContain("--pdp-widget-height");
    expect(stage?.className).not.toContain("--pdp-widget-height");
    expect(stage?.className).toContain("flex-1");
    expect(stage?.className).toContain("min-h-0");
  });

  // The PDP wraps its content in a 16px gutter (`px-4`). The photos are
  // full-bleed studio shots, so honouring it read as a crop. Both halves
  // matter: the negative margin alone would shift the stage without widening it.
  it("breaks the stage out of the page gutter on mobile, and only on mobile", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    const stage = container.querySelector("[data-gallery-stage]");

    expect(stage?.className).toContain("-mx-4");
    expect(stage?.className).toContain("w-[calc(100%+2rem)]");
    expect(stage?.className).toContain("md:mx-0");
    expect(stage?.className).toContain("md:w-full");
  });

  it("keeps the badge and the counter clear of the screen edge on mobile", () => {
    const { container } = render(
      <ProductGallery images={IMAGES} title={TITLE} badge={<span>NEW</span>} />,
    );

    expect(container.querySelector("[data-gallery-badge]")?.className).toContain("left-7");
    expect(screen.getByText("1 / 5").className).toContain("right-6");
  });

  it("dims the stage for a sold-out product", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} dimmed />);

    expect(container.querySelector("[data-gallery-region]")?.className).toContain(
      "opacity-40",
    );
  });

  it("renders neither a rail nor a counter for a single-image product", () => {
    const { container } = render(<ProductGallery images={[IMAGES[1]!]} title={TITLE} />);

    expect(slideImages(container)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /imagen \d+ de \d+/i })).toBeNull();
    expect(screen.queryByText(/^\d+ \/ \d+$/)).toBeNull();
  });

  // The window is what keeps a photo from fading in mid-gesture: `lazy`
  // inside a snap container commits far too late for a slide one swipe away.
  it("commits the next slide ahead of the selection on mobile", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(slideLoading(container)).toEqual(["eager", "eager", "lazy", "lazy", "lazy"]);

    swipeTo(container, 2);

    expect(slideLoading(container)).toEqual(["eager", "eager", "eager", "eager", "lazy"]);
  });

  it("commits the next slide ahead of the selection on desktop", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));
    const node = viewport(container);
    measure(node);

    scrollViewportTo(node, 2 * SLIDE_HEIGHT);

    expect(slideLoading(container)).toEqual(["eager", "eager", "eager", "eager", "lazy"]);
  });

  // React's server renderer preloads every non-lazy <img> in the shell, so
  // the eager window was already emitting several equal-priority preloads that
  // the hero had to race. The lane is the part we own.
  it("races the hero photo ahead of the speculative slides", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(
      slideImages(container).map((image) => image.getAttribute("fetchpriority")),
    ).toEqual(["high", "low", "low", "low", "low"]);
  });

  it("declares the inflated desktop width and the honest mobile one", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    expect(slideImages(container)[0]!.getAttribute("sizes")).toBe(
      "(min-width: 768px) 1120px, 100vw",
    );
  });
});
