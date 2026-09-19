import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { ProductGallery } from "../product-gallery";
import { MAX_BLUR_PX } from "../slide-blur";

const emblaHarness = vi.hoisted(() => ({
  ready: true,
  selected: 0,
  viewport: null as HTMLElement | null,
  slides: [] as HTMLElement[],
  listeners: new Map<string, Set<(api: unknown) => void>>(),
  renderers: new Set<() => void>(),
  scrollTo: vi.fn(),
  api: null as unknown,
  apis: [] as Array<{
    api: unknown;
    listeners: Map<string, Set<(api: unknown) => void>>;
    scrollTo: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("embla-carousel-react", async () => {
  const React = await import("react");

  function useEmblaCarousel() {
    const [, render] = React.useReducer((value: number) => value + 1, 0);
    const apiState = React.useMemo(() => {
      const listeners = new Map<string, Set<(api: unknown) => void>>();
      const scrollTo = vi.fn();
      const api = {
        canScrollPrev: () => emblaHarness.selected > 0,
        canScrollNext: () => true,
        off(event: string, listener: (api: unknown) => void) {
          listeners.get(event)?.delete(listener);
          return api;
        },
        on(event: string, listener: (api: unknown) => void) {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(listener);
          listeners.set(event, eventListeners);
          return api;
        },
        scrollNext: vi.fn(),
        scrollPrev: vi.fn(),
        scrollProgress: () => emblaHarness.selected,
        scrollTo,
        selectedScrollSnap: () => emblaHarness.selected,
        slideNodes: () => emblaHarness.slides,
      };

      emblaHarness.api = api;
      emblaHarness.listeners = listeners;
      emblaHarness.scrollTo = scrollTo;
      emblaHarness.apis.push({ api, listeners, scrollTo });
      return api;
    }, []);
    const carouselRef = React.useCallback((node: HTMLElement | null) => {
      emblaHarness.viewport = node;
      if (node) {
        emblaHarness.slides = Array.from(
          node.firstElementChild?.children ?? [],
        ) as HTMLElement[];
      }
    }, []);

    React.useEffect(() => {
      emblaHarness.renderers.add(render);
      return () => {
        emblaHarness.renderers.delete(render);
      };
    }, []);

    return [carouselRef, emblaHarness.ready ? apiState : undefined] as const;
  }

  return { default: useEmblaCarousel };
});

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

function mobileStage(container: HTMLElement): HTMLDivElement {
  const stage = container.querySelector<HTMLDivElement>("[data-gallery-mobile-stage]");

  if (!stage) throw new Error("Expected the native mobile gallery stage");

  return stage;
}

function observeMobileIndex(container: HTMLElement, index: number): void {
  const stage = mobileStage(container);

  Object.defineProperty(stage, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(stage, "scrollLeft", {
    configurable: true,
    writable: true,
    value: index * 100,
  });
  fireEvent.scroll(stage);
}

function setEmblaReady(ready: boolean): void {
  act(() => {
    emblaHarness.ready = ready;
    emblaHarness.renderers.forEach((render) => render());
  });
}

function emitEmblaSelection(index: number): void {
  act(() => {
    emblaHarness.selected = index;
    emblaHarness.listeners
      .get("select")
      ?.forEach((listener) => listener(emblaHarness.api));
  });
}

const NO_BLUR = Array<string>(5).fill("");

beforeEach(() => {
  emblaHarness.ready = true;
  emblaHarness.selected = 0;
  emblaHarness.viewport = null;
  emblaHarness.slides = [];
  emblaHarness.listeners.clear();
  emblaHarness.scrollTo.mockClear();
  emblaHarness.apis = [];
});

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

  it("names the mobile carousel and its slide positions for assistive technology", () => {
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    expect(
      screen.getByRole("region", { name: `Galería de imágenes de ${TITLE}` }),
    ).not.toBeNull();
    expect(screen.getByRole("group", { name: "Imagen 1 de 5" })).not.toBeNull();
    expect(screen.getByRole("group", { name: "Imagen 5 de 5" })).not.toBeNull();
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

  it("lets native scroll geometry confirm a mobile thumbnail selection", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );
    const stage = mobileStage(container);
    const scrollTo = vi.fn();

    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(stage, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(stage, "scrollLeft", { configurable: true, writable: true, value: 0 });

    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "smooth" });
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    stage.scrollLeft = 200;
    fireEvent.scroll(stage);

    expect(thumbnails()[2]!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("renders thumbnails as native buttons without intercepting Enter", () => {
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    const third = thumbnails()[2]!;
    third.focus();
    const enterDispatched = fireEvent.keyDown(third, { key: "Enter" });

    expect(document.activeElement).toBe(third);
    expect(third.tagName).toBe("BUTTON");
    expect(third.getAttribute("type")).toBe("button");
    expect(enterDispatched).toBe(true);
  });

  it("counts the selected image on mobile, and follows the selection", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    expect(screen.getByText("1 / 5")).not.toBeNull();

    observeMobileIndex(container, 3);

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

  it("preserves the shared selection through both responsive engine handoffs", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    observeMobileIndex(container, 2);
    expect(screen.getByText("3 / 5")).not.toBeNull();

    act(() => setViewport("desktop"));
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");

    act(() => setViewport("mobile"));
    expect(screen.getByText("3 / 5")).not.toBeNull();
  });

  it("flushes a desktop selector command after Embla becomes ready and waits for confirmation", () => {
    emblaHarness.ready = false;
    act(() => setViewport("desktop"));
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    fireEvent.click(thumbnails()[2]!);
    fireEvent.click(thumbnails()[3]!);

    expect(emblaHarness.scrollTo).not.toHaveBeenCalled();
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    setEmblaReady(true);

    expect(emblaHarness.scrollTo).toHaveBeenCalledTimes(1);
    expect(emblaHarness.scrollTo).toHaveBeenCalledWith(3);
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    emitEmblaSelection(3);

    expect(thumbnails()[3]!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("does not let an unmounted Embla API consume a selector command on desktop re-entry", () => {
    act(() => setViewport("desktop"));
    render(<ProductGallery images={FIVE_IMAGES} title={TITLE} />);

    const oldApi = emblaHarness.apis[0]!;
    oldApi.scrollTo.mockClear();

    act(() => setViewport("mobile"));
    setEmblaReady(false);
    act(() => setViewport("desktop"));

    const newApi = emblaHarness.apis[1]!;
    expect(newApi.api).not.toBe(oldApi.api);
    const oldCallCount = oldApi.scrollTo.mock.calls.length;

    fireEvent.click(thumbnails()[2]!);

    expect(oldApi.scrollTo).toHaveBeenCalledTimes(oldCallCount);
    expect(newApi.scrollTo).not.toHaveBeenCalled();
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    setEmblaReady(true);

    expect(oldApi.scrollTo).toHaveBeenCalledTimes(oldCallCount);
    expect(newApi.scrollTo).toHaveBeenCalledTimes(1);
    expect(newApi.scrollTo).toHaveBeenCalledWith(2);
    expect(thumbnails()[0]!.getAttribute("aria-pressed")).toBe("true");

    emitEmblaSelection(2);

    expect(thumbnails()[2]!.getAttribute("aria-pressed")).toBe("true");
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

  it("gates desktop slide interaction and clears all owned styles on mobile handoff", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    act(() => setViewport("desktop"));
    const slides = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );

    expect(slides[0]?.style.transform).toBe("scale(1)");
    expect(slides[0]?.style.pointerEvents).toBe("auto");
    expect(slides[1]?.style.transform).toBe("scale(0.85)");
    expect(slides[1]?.style.opacity).toBe("0.4");
    expect(slides[1]?.style.pointerEvents).toBe("none");

    act(() => setViewport("mobile"));

    for (const slide of slides) {
      expect(slide.style.transform).toBe("");
      expect(slide.style.opacity).toBe("");
      expect(slide.style.filter).toBe("");
      expect(slide.style.pointerEvents).toBe("");
    }
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

  it("observes the nearest native mobile slide without correcting a gesture", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );
    const stage = mobileStage(container);
    const scrollTo = vi.fn();

    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(stage, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(stage, "scrollLeft", { configurable: true, writable: true, value: 160 });

    fireEvent.scroll(stage);

    expect(screen.getByText("3 / 5")).not.toBeNull();
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps a valid selection at zero width and scrolls only for thumbnail activation", () => {
    const { container } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );
    const stage = mobileStage(container);
    const scrollTo = vi.fn();

    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 0 });
    Object.defineProperty(stage, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(stage, "scrollLeft", { configurable: true, writable: true, value: 400 });

    fireEvent.scroll(stage);
    expect(screen.getByText("1 / 5")).not.toBeNull();

    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 100 });
    fireEvent.click(thumbnails()[2]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "smooth" });
    stage.scrollLeft = 200;
    fireEvent.scroll(stage);
    expect(thumbnails()[2]?.getAttribute("aria-current")).toBe("true");
  });

  it("resets selection when image identity or order changes", () => {
    const { container, rerender } = render(
      <ProductGallery images={FIVE_IMAGES} title={TITLE} />,
    );

    observeMobileIndex(container, 3);
    expect(screen.getByText("4 / 5")).not.toBeNull();

    rerender(
      <ProductGallery
        images={[
          ...FIVE_IMAGES.slice(0, 4),
          { id: 304, src: "/products/replaced.png", position: 4 },
        ]}
        title={TITLE}
      />,
    );

    expect(screen.getByText("1 / 5")).not.toBeNull();
    expect(mobileStage(container).scrollLeft).toBe(0);
  });
});
