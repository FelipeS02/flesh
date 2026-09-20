import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { installControllableIntersectionObserver } from "../../../test/fixtures/observers";
import type { ImageView } from "@/modules/catalog/client";
import { CardMedia } from "./card-media";

const BASE = "https://dcdn-us.mitiendanube.com/stores/008/176/730/products/front";

function image(id: number): ImageView {
  return { id, src: `${BASE}-${id}-1024-1024.png`, position: id };
}

const IMAGES = [image(1), image(2)];

// Not a role query, and that is the point rather than a shortcut: these
// photos carry `alt=""` deliberately — the card's heading already names the
// product, so announcing them would be repeating it — and an empty alt makes
// the element `role="presentation"`, which `getByRole("img")` will never
// match. Querying the tag is what the markup actually promises. It is still
// never a copy query: nothing here depends on a string that is free to change.
function photos(): HTMLImageElement[] {
  return [...document.querySelectorAll("img")];
}

let observer: ReturnType<typeof installControllableIntersectionObserver> | null = null;

afterEach(() => {
  observer?.restore();
  observer = null;
});

describe("CardMedia", () => {
  it("renders the cover and the hover alternate when both exist", () => {
    render(<CardMedia images={IMAGES} />);

    expect(photos()).toHaveLength(2);
  });

  it("renders only the cover when the product has a single photo", () => {
    render(<CardMedia images={[image(1)]} />);

    expect(photos()).toHaveLength(1);
  });

  it("renders nothing at all when the product has no photos", () => {
    const { container } = render(<CardMedia images={[]} />);

    expect(container.innerHTML).toBe("");
  });

  it("starts the cover transparent so the load can fade it in", () => {
    render(<CardMedia images={IMAGES} />);

    // Asserts that the fade is ANIMATED, not which utility animates it:
    // pinning the exact class name turns a styling choice into a red test.
    expect(photos()[0].className).toContain("opacity-0");
    expect(photos()[0].className).toMatch(/\btransition-/);
  });

  it("fades the cover in once it loads", async () => {
    render(<CardMedia images={IMAGES} />);
    const cover = photos()[0];

    await act(async () => {
      cover.dispatchEvent(new Event("load"));
    });

    expect(cover.dataset.loaded).toBe("true");
    expect(cover.className).toContain("opacity-100");
  });

  it("keeps the alternate hidden until the group is hovered", () => {
    render(<CardMedia images={IMAGES} />);
    const alternate = photos()[1];

    expect(alternate.className).toContain("opacity-0");
    expect(alternate.className).toContain("group-hover:opacity-100");
  });

  it("hands the cover the hover-out class only when there is an alternate", () => {
    const { unmount } = render(<CardMedia images={IMAGES} />);
    expect(photos()[0].className).toContain("group-hover:opacity-0");

    unmount();
    render(<CardMedia images={[image(1)]} />);
    expect(photos()[0].className).not.toContain("group-hover:opacity-0");
  });

  it("dims the frame rather than the photos, so sold-out cards still fade in", () => {
    const { container } = render(<CardMedia images={IMAGES} dimmed />);

    // The knock-back must NOT sit on the same element as the fade: `cn` is
    // twMerge, and an opacity-40 there would erase opacity-0/opacity-100 and
    // strand the card invisible.
    expect(container.querySelector("[data-card-media]")?.className).toContain(
      "opacity-40",
    );
    expect(photos()[0].className).not.toContain("opacity-40");
  });
});

describe("CardMedia observation", () => {
  it("renders no photo until the card reaches the viewport", () => {
    observer = installControllableIntersectionObserver();

    render(<CardMedia images={IMAGES} observe />);

    expect(photos()).toHaveLength(0);
    expect(observer.observed()).toBe(1);
  });

  it("mounts the photos once the card intersects", async () => {
    observer = installControllableIntersectionObserver();
    render(<CardMedia images={IMAGES} observe />);

    await act(async () => {
      observer?.enter();
    });

    expect(photos()).toHaveLength(2);
  });

  it("mounts an observed photo EAGER, so the preload margin is not spent twice", async () => {
    observer = installControllableIntersectionObserver();
    render(<CardMedia images={IMAGES} observe />);

    await act(async () => {
      observer?.enter();
    });

    // The observer fires before the card is on screen. Native lazy loading
    // on top would re-defer the fetch against the browser's own threshold
    // and cancel the head start the margin exists to buy.
    expect(photos()[0].getAttribute("loading")).toBe("eager");
  });

  it("keeps native lazy loading when nothing else is deferring the card", () => {
    render(<CardMedia images={IMAGES} />);

    expect(photos()[0].getAttribute("loading")).toBe("lazy");
  });

  it("never defers a priority card behind the observer", () => {
    observer = installControllableIntersectionObserver();

    render(<CardMedia images={IMAGES} observe priority />);

    // Delaying the LCP image to save a request that was happening anyway is
    // the one case where observing costs more than it buys.
    expect(photos()).toHaveLength(2);
    expect(observer.observed()).toBe(0);
    expect(photos()[0].getAttribute("loading")).toBe("eager");
  });

  // Pins the BEHAVIOUR the `priority` prop buys, so the Next 16 rename off
  // the deprecated prop underneath it is provably a rename and nothing else.
  // `loading="eager"` above is only half of it: the head link is what starts
  // the fetch before the parser ever reaches the card.
  it("puts an above-the-fold cover in the head as a preload", () => {
    render(<CardMedia images={IMAGES} priority />);

    const preloaded = [
      ...document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="preload"][as="image"]',
      ),
    ].map((link) => link.getAttribute("imagesrcset") ?? link.href);

    // The cover alone. The hover alternate is never what the page is
    // measured on, and preloading it would spend the head start twice.
    expect(preloaded.some((src) => src.includes("front-1-640-0.webp"))).toBe(
      true,
    );
    expect(preloaded.some((src) => src.includes("front-2-640-0.webp"))).toBe(
      false,
    );
  });
});

describe("CardMedia sources", () => {
  it("asks the CDN for a sized WebP derivative instead of the original", () => {
    render(<CardMedia images={IMAGES} />);

    // 320 CSS px at 2x is 640 — the widest derivative the CDN generates, and
    // an exact fit for the desktop card.
    expect(photos()[0].getAttribute("src")).toBe(`${BASE}-1-640-0.webp`);
  });

  it("bypasses the Next optimizer for a derivative that is already right", () => {
    render(<CardMedia images={IMAGES} />);

    // An optimized src is rewritten through `/_next/image`; an unoptimized
    // one reaches the CDN untouched.
    expect(photos()[0].getAttribute("src")).not.toContain("/_next/image");
  });
});

describe("CardMedia hover", () => {
  it("exposes both photos to a pointer without remounting either", () => {
    const { container } = render(
      <div className="group">
        <CardMedia images={IMAGES} />
      </div>,
    );

    const before = photos().map((photo) => photo.getAttribute("src"));
    fireEvent.mouseEnter(container.firstElementChild as Element);

    // The swap is CSS on a `group-hover` variant, so hovering must not change
    // what is mounted — a remount would re-fetch and flash on every pass.
    expect(photos().map((photo) => photo.getAttribute("src"))).toEqual(before);
  });
});
