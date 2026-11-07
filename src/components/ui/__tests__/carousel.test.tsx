import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../carousel";

// The real embla instance needs a live DOM layout jsdom cannot provide, and
// this test only cares about which classes land on which div — a ref that
// never calls back is enough to let the tree mount.
// `api` stays undefined by default (the layout tests above never need one);
// the arrow tests switch on a stub that records scrolls and reports the ends.
const embla = vi.hoisted(() => ({
  api: undefined as unknown,
}));

function useEmblaCarouselStub() {
  return [() => {}, embla.api] as const;
}

vi.mock("embla-carousel-react", () => ({ default: useEmblaCarouselStub }));

function viewportOf(container: HTMLElement): Element | null {
  return container.querySelector('[data-slot="carousel-content"]');
}

describe("CarouselContent", () => {
  it("keeps overflow-hidden as the viewport's default when no viewportClassName is passed", () => {
    const { container } = render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    expect(viewportOf(container)?.className).toBe("overflow-hidden");
  });

  it("merges viewportClassName into the viewport div, alongside overflow-hidden", () => {
    const { container } = render(
      <Carousel>
        <CarouselContent viewportClassName="overflow-x-auto">
          <CarouselItem>slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const viewport = viewportOf(container);

    // `cn()` (tailwind-merge) does not treat `overflow-hidden` and
    // `overflow-x-auto` as the same conflict group, so both classes land in
    // the string — the same "overflow-hidden overflow-y-auto" idiom Tailwind
    // resolves through its own utility order, not through twMerge dedup.
    // This test only proves the class made it through the merge.
    expect(viewport?.className).toContain("overflow-x-auto");
  });

  it("never forwards viewportClassName to the inner track div", () => {
    const { container } = render(
      <Carousel>
        <CarouselContent viewportClassName="overflow-x-auto">
          <CarouselItem>slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const track = viewportOf(container)?.firstElementChild;

    expect(track?.className).not.toContain("overflow-x-auto");
  });
});

describe("CarouselPrevious / CarouselNext", () => {
  const scrollPrev = vi.fn();
  const scrollNext = vi.fn();

  function mountWithApi(canPrev: boolean, canNext: boolean) {
    embla.api = {
      canScrollPrev: () => canPrev,
      canScrollNext: () => canNext,
      scrollPrev,
      scrollNext,
      on: () => embla.api,
      off: () => embla.api,
    };

    return render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>slide</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
  }

  beforeEach(() => {
    scrollPrev.mockClear();
    scrollNext.mockClear();
  });

  it("names both arrows in Spanish", () => {
    mountWithApi(true, true);

    expect(screen.getByRole("button", { name: "Imagen anterior" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBeDefined();
  });

  it("scrolls the carousel from the matching arrow", () => {
    mountWithApi(true, true);

    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));

    expect(scrollNext).toHaveBeenCalledTimes(1);
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });

  it("disables the arrow that has nowhere to go", () => {
    mountWithApi(false, true);

    expect(screen.getByRole("button", { name: "Imagen anterior" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Imagen siguiente" })).toHaveProperty("disabled", false);
  });

  // Each arrow is an invisible hit area over one half of the slide, with the
  // glyph pushed to the outer edge; the glyph is decoration, the label is the name.
  it("covers one half of the slide each, on the side it points to", () => {
    mountWithApi(true, true);

    const prev = screen.getByRole("button", { name: "Imagen anterior" });
    const next = screen.getByRole("button", { name: "Imagen siguiente" });

    expect(prev.className).toContain("left-0");
    expect(prev.className).toContain("w-1/2");
    expect(next.className).toContain("right-0");
    expect(next.className).toContain("w-1/2");
    expect(prev.textContent).toBe("<<");
    expect(next.textContent).toBe(">>");
  });

  it("draws the glyph in the display font with a hard shadow, brand red on hover", () => {
    mountWithApi(true, true);

    const { className } = screen.getByRole("button", { name: "Imagen siguiente" });

    expect(className).toContain("font-display");
    expect(className).toContain("text-shadow-[4px_4px_0_black]");
    expect(className).toContain("hover:text-primary");
    expect(className).toContain("rounded-none");
  });

  // Button's press feedback is a 1px translate. On an absolutely positioned
  // arrow that translate REPLACES any centring transform, so the arrow jumped
  // on every click; the colour change is the arrow's press feedback instead.
  it("cancels the button's press translate", () => {
    mountWithApi(true, true);

    for (const name of ["Imagen anterior", "Imagen siguiente"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "active:not-aria-[haspopup]:translate-y-0",
      );
    }
  });
});
