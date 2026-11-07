import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { setViewport } from "../../../../../test/fixtures/viewport";
import { MAX_BLUR_PX } from "../../gallery/slide-blur";
import { PreviewGallery } from "../preview-gallery";

// Embla measures layout, which jsdom does not have. The stand-in keeps only the
// contract the gallery reads (selected snap, prev/next/scrollTo, `select`) and
// records the options it was started with, so the tests prove OUR wiring and
// whether Embla runs at all, not Embla itself.
const embla = vi.hoisted(() => ({
  count: 0,
  options: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("embla-carousel-react", async () => {
  const React = await import("react");

  function useEmblaCarousel(options?: Record<string, unknown>) {
    embla.options.push(options);
    const api = React.useMemo(() => {
      const listeners = new Map<string, Set<(api: unknown) => void>>();
      let selected = 0;
      const go = (to: number) => {
        selected = Math.min(Math.max(to, 0), embla.count - 1);
        listeners.get("select")?.forEach((fn) => fn(api));
      };
      const api = {
        canScrollPrev: () => selected > 0,
        canScrollNext: () => selected < embla.count - 1,
        scrollPrev: () => go(selected - 1),
        scrollNext: () => go(selected + 1),
        scrollTo: (index: number) => go(index),
        selectedScrollSnap: () => selected,
        on(event: string, fn: (api: unknown) => void) {
          const set = listeners.get(event) ?? new Set();
          set.add(fn);
          listeners.set(event, set);
          return api;
        },
        off(event: string, fn: (api: unknown) => void) {
          listeners.get(event)?.delete(fn);
          return api;
        },
      };

      return api;
    }, []);

    return [() => undefined, api] as const;
  }

  return { default: useEmblaCarousel };
});

function images(count: number): ImageView[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    src: `/products/${index + 1}.png`,
    position: index + 1,
    width: 1024,
    height: 1160,
  }));
}

function renderGallery(count: number, viewport: "desktop" | "mobile" = "desktop") {
  embla.count = count;
  embla.options.length = 0;
  setViewport(viewport);

  return render(
    <PreviewGallery images={images(count)} title='Army' badge={<span>PREVIEW</span>} />,
  );
}

function thumbs() {
  return screen.queryAllByRole("button", { name: /ver imagen \d+ de \d+/i });
}

function current() {
  return thumbs().findIndex((thumb) => thumb.getAttribute("aria-current") === "true");
}

function slides(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'));
}

describe("PreviewGallery", () => {
  it("starts on the first image", () => {
    renderGallery(3);

    expect(current()).toBe(0);
  });

  it("moves to the next image with the next arrow and marks its thumbnail", () => {
    renderGallery(3);

    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));

    expect(current()).toBe(1);
  });

  it("moves back with the previous arrow", () => {
    renderGallery(3);
    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));

    fireEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));

    expect(current()).toBe(0);
  });

  it("jumps to an image from its thumbnail", () => {
    renderGallery(3);

    fireEvent.click(thumbs()[2]!);

    expect(current()).toBe(2);
  });

  it("blurs and fades only the slides beside the active one, on the regular gallery's curve", () => {
    const { container } = renderGallery(3);
    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));

    const filters = slides(container).map((slide) => slide.style.filter);

    expect(filters).toEqual([`blur(${MAX_BLUR_PX}px)`, "blur(0px)", `blur(${MAX_BLUR_PX}px)`]);
  });

  // The badge and the arrows are one overlay over the stage, not a copy per
  // slide: they exist exactly once and survive a step without remounting.
  it("renders the badge and each arrow exactly once, whatever the slide count", () => {
    for (const count of [2, 5]) {
      const { unmount } = renderGallery(count);

      expect(screen.getAllByText("PREVIEW")).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Imagen siguiente" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Imagen anterior" })).toHaveLength(1);
      unmount();
    }
  });

  it("keeps the same badge and arrow nodes when the selection changes", () => {
    const { container } = renderGallery(3);
    const badge = screen.getByText("PREVIEW");
    const next = screen.getByRole("button", { name: "Imagen siguiente" });

    fireEvent.click(next);

    expect(screen.getByText("PREVIEW")).toBe(badge);
    expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBe(next);
    expect(container.querySelector("[data-stage-overlay]")?.contains(badge)).toBe(true);
    expect(slides(container).some((slide) => slide.contains(badge))).toBe(false);
  });

  it("lets clicks through the overlay but not the arrows", () => {
    const { container } = renderGallery(3);

    expect(container.querySelector("[data-stage-overlay]")?.className).toContain("pointer-events-none");
    expect(screen.getByRole("button", { name: "Imagen siguiente" }).className).toContain(
      "pointer-events-auto",
    );
  });

  it("sizes the overlay from the selected photo's ratio", () => {
    embla.count = 2;
    setViewport("desktop");
    const photos: ImageView[] = [
      { id: 1, src: "/a.png", position: 1, width: 1000, height: 1000 },
      { id: 2, src: "/b.png", position: 2, width: 1000, height: 500 },
    ];
    const { container } = render(<PreviewGallery images={photos} title='Army' />);
    const overlay = () => container.querySelector<HTMLElement>("[data-stage-overlay]")!;

    expect(overlay().style.getPropertyValue("--active-ratio")).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));

    expect(overlay().style.getPropertyValue("--active-ratio")).toBe("2");
  });

  // The native strip's end padding is what lets snap-center park a slide
  // exactly in the middle. One shared spacer was derived from a single ratio,
  // so a last photo wider or narrower than the first sat off-centre and clipped.
  it("pads the mobile strip from the first and last photos' own widths", () => {
    embla.count = 3;
    setViewport("mobile");
    const photos: ImageView[] = [
      { id: 1, src: "/a.png", position: 1, width: 1000, height: 1000 },
      { id: 2, src: "/b.png", position: 2, width: 1000, height: 1000 },
      { id: 3, src: "/c.png", position: 3, width: 1000, height: 500 },
    ];
    const { container } = render(<PreviewGallery images={photos} title='Army' />);
    const root = container.firstElementChild as HTMLElement;
    const viewport = container.querySelector('[data-slot="carousel-content"]')!;

    expect(root.style.getPropertyValue("--pad-start")).toBe("calc((100vw - 388px * 1) / 2)");
    expect(root.style.getPropertyValue("--pad-end")).toBe("calc((100vw - 388px * 2) / 2)");
    expect(viewport.className).toContain("max-md:ps-(--pad-start)");
    expect(viewport.className).toContain("max-md:pe-(--pad-end)");
  });

  it("no longer spaces the strip with per-slide margins", () => {
    const { container } = renderGallery(3, "mobile");

    expect(slides(container).some((slide) => slide.className.includes("first:ml"))).toBe(false);
  });

  it("puts the arrows' hit areas outside the photo, on its sides", () => {
    renderGallery(3);

    const prev = screen.getByRole("button", { name: "Imagen anterior" });
    const next = screen.getByRole("button", { name: "Imagen siguiente" });

    expect(prev.style.left).toBe("-72px");
    expect(next.style.right).toBe("-72px");
    expect(prev.style.width).toBe("calc(50% + 72px)");
    expect(next.style.width).toBe("calc(50% + 72px)");
  });

  it("sizes each slide from its own photo's ratio", () => {
    const { container } = renderGallery(2);

    expect(slides(container)[0]!.style.getPropertyValue("--slide-ratio")).toBe("1024 / 1160");
  });

  it("shows no arrows and no thumbnails for a single image", () => {
    renderGallery(1);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks for the first image at high priority and no other", () => {
    const { container } = renderGallery(3);

    const priorities = Array.from(container.querySelectorAll("img"))
      .filter((img) => img.getAttribute("alt") !== "")
      .map((img) => img.getAttribute("fetchpriority"));

    expect(priorities[0]).toBe("high");
    expect(priorities.slice(1)).not.toContain("high");
  });

  it("loads the neighbours lazily", () => {
    const { container } = renderGallery(3);

    const loading = Array.from(container.querySelectorAll("img"))
      .filter((img) => img.getAttribute("alt") !== "")
      .map((img) => img.getAttribute("loading"));

    expect(loading).toEqual(["eager", "lazy", "lazy"]);
  });

  it("runs Embla on desktop", () => {
    renderGallery(3, "desktop");

    expect(embla.options.at(-1)).toMatchObject({ active: true, align: "center" });
  });

  it("does not run Embla below md, where native scroll-snap moves the slides", () => {
    const { container } = renderGallery(3, "mobile");

    expect(embla.options.at(-1)).toMatchObject({ active: false });
    expect(
      container.querySelector('[data-slot="carousel-content"]')?.className,
    ).toContain("snap-x");
  });

  it("labels the region and each slide in Spanish", () => {
    renderGallery(2);

    expect(screen.queryByRole("region", { name: /galería de imágenes de army/i })).not.toBeNull();
    expect(screen.getAllByRole("group", { name: /imagen \d de 2/i })).toHaveLength(2);
  });
});
