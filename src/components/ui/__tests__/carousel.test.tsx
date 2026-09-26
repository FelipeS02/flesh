import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Carousel, CarouselContent, CarouselItem } from "../carousel";

// The real embla instance needs a live DOM layout jsdom cannot provide, and
// this test only cares about which classes land on which div — a ref that
// never calls back is enough to let the tree mount.
function useEmblaCarouselStub() {
  return [() => {}, undefined] as const;
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
