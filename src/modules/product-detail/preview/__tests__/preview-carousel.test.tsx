import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ImageView } from "@/modules/catalog";
import { PreviewCarousel } from "../preview-carousel";

// Embla measures layout, which jsdom does not have. The stand-in keeps only the
// contract the carousel reads: a selected snap, prev/next, and the `select`
// event, so the tests prove OUR wiring (arrows -> dashes), not Embla itself.
const embla = vi.hoisted(() => ({ count: 0 }));

vi.mock("embla-carousel-react", async () => {
  const React = await import("react");

  function useEmblaCarousel() {
    const api = React.useMemo(() => {
      const listeners = new Map<string, Set<(api: unknown) => void>>();
      let selected = 0;
      const emit = () => listeners.get("select")?.forEach((fn) => fn(api));
      const go = (to: number) => {
        selected = Math.min(Math.max(to, 0), embla.count - 1);
        emit();
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
  }));
}

function renderCarousel(count: number) {
  embla.count = count;

  return render(
    <PreviewCarousel
      images={images(count)}
      title='Army'
      badge={<span>PREVIEW</span>}
    />,
  );
}

function dashes() {
  return screen.queryAllByRole("button", { name: /ver imagen \d+ de \d+/i });
}

function current() {
  return dashes().findIndex((dash) => dash.getAttribute("aria-current") === "true");
}

describe("PreviewCarousel", () => {
  it("starts on the first image", () => {
    renderCarousel(3);

    expect(current()).toBe(0);
  });

  it("moves to the next image and marks its dash current", () => {
    renderCarousel(3);

    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));

    expect(current()).toBe(1);
  });

  it("moves back with the previous arrow", () => {
    renderCarousel(3);
    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));

    fireEvent.click(screen.getByRole("button", { name: /imagen anterior/i }));

    expect(current()).toBe(0);
  });

  it("jumps to an image from its dash", () => {
    renderCarousel(3);

    fireEvent.click(dashes()[2]!);

    expect(current()).toBe(2);
  });

  it("fades every slide but the active one", () => {
    const { container } = renderCarousel(3);
    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));

    const slides = container.querySelectorAll('[data-slot="carousel-item"]');

    expect(
      Array.from(slides).map((slide) => slide.hasAttribute("data-active")),
    ).toEqual([false, true, false]);
  });

  it("cannot step past either end", () => {
    renderCarousel(2);

    expect(screen.getByRole("button", { name: /imagen anterior/i })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));

    expect(screen.getByRole("button", { name: /imagen siguiente/i })).toHaveProperty("disabled", true);
  });

  it("shows no controls for a single image", () => {
    renderCarousel(1);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks for the first image at high priority and no other", () => {
    const { container } = renderCarousel(3);

    const priorities = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("fetchpriority"),
    );

    expect(priorities[0]).toBe("high");
    expect(priorities.slice(1)).not.toContain("high");
  });

  it("loads the neighbours lazily", () => {
    const { container } = renderCarousel(3);

    const loading = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("loading"),
    );

    expect(loading).toEqual(["eager", "lazy", "lazy"]);
  });

  it("keeps the badge over the carousel", () => {
    renderCarousel(2);

    expect(screen.queryByText("PREVIEW")).not.toBeNull();
  });

  it("labels the region and each slide in Spanish", () => {
    renderCarousel(2);

    expect(
      screen.queryByRole("region", { name: /galería de imágenes de army/i }),
    ).not.toBeNull();
    expect(screen.getAllByRole("group", { name: /imagen \d de 2/i })).toHaveLength(2);
  });
});
