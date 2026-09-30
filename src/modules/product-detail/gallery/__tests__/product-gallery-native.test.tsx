import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { ProductGallery } from "../product-gallery";
import { MAX_BLUR_PX } from "../slide-blur";

// A getter, not a value: the config is read at render time, so each test can
// pick the snap flag without re-importing the module graph.
const config = vi.hoisted(() => ({ snap: false }));

vi.mock("../gallery-config", () => ({
  DESKTOP_GALLERY_ENGINE: "native-scroll",
  get DESKTOP_SCROLL_SNAP() {
    return config.snap;
  },
}));

// A slim Embla: the native engine only needs it to EXIST (inactive on every
// breakpoint) and to hand back the viewport node through `rootNode()`.
const embla = vi.hoisted(() => ({
  viewport: null as HTMLElement | null,
  options: [] as unknown[],
}));

vi.mock("embla-carousel-react", async () => {
  const React = await import("react");

  function useEmblaCarousel(options: unknown) {
    embla.options.push(options);
    const api = React.useMemo(
      () => ({
        on: () => api,
        off: () => api,
        rootNode: () => embla.viewport,
        slideNodes: () => [],
        scrollTo: vi.fn(),
        canScrollPrev: () => false,
        canScrollNext: () => false,
      }),
      [],
    );
    const ref = React.useCallback((node: HTMLElement | null) => {
      embla.viewport = node;
    }, []);

    return [ref, api] as const;
  }

  return { default: useEmblaCarousel };
});

const IMAGES: ImageView[] = [1, 2, 3, 4, 5].map((id) => ({
  id,
  src: `/products/${id}.png`,
  position: id,
}));

const TITLE = "Musculosa Demon Wash Black";
const SLIDE_HEIGHT = 722;

const frames: FrameRequestCallback[] = [];

function viewport(container: HTMLElement): HTMLDivElement {
  const node = container.querySelector<HTMLDivElement>('[data-slot="carousel-content"]');

  if (!node) throw new Error("Expected the carousel's viewport element");

  return node;
}

function slides(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'));
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
  embla.viewport = null;
  embla.options = [];
  frames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductGallery with the native-scroll desktop engine", () => {
  it("keeps Embla inactive on every breakpoint", () => {
    render(<ProductGallery images={IMAGES} title={TITLE} />);

    for (const options of embla.options) {
      expect(options).toMatchObject({ active: false });
      expect(options).not.toHaveProperty("breakpoints");
    }
  });

  it("makes the viewport the vertical scroller on desktop, at a fixed stage height", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const classes = viewport(container).className;

    expect(classes).toContain("md:overflow-y-auto");
    expect(classes).toContain("md:overflow-x-hidden");
    expect(classes).toContain("scrollbar-none");
    expect(container.querySelector("[data-slot=carousel]")?.className).toContain(
      "md:h-180.5",
    );
  });

  it("lays slides out as full-height blocks rather than flex-basis slots", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);

    for (const slide of slides(container)) {
      expect(slide.className).toContain("md:h-180.5");
      expect(slide.className).toContain("md:basis-auto");
    }
  });

  it("fades the top and bottom edges through independent mask properties", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    const classes = container.querySelector("[data-slot=carousel]")?.className ?? "";

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
    expect(stageVar(container, "--gallery-mask-top")).toBe("94%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("88%");
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
    expect(stageVar(container, "--gallery-mask-top")).toBe("88%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("88%");
  });

  it("has no top fade on the first slide, only the bottom one", () => {
    const { container } = render(<ProductGallery images={IMAGES} title={TITLE} />);
    act(() => setViewport("desktop"));

    expect(stageVar(container, "--gallery-mask-top")).toBe("100%");
    expect(stageVar(container, "--gallery-mask-bottom")).toBe("88%");
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
