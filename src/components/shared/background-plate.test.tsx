import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundPlate, PageScrim } from "./background-plate";

describe("BackgroundPlate", () => {
  it("renders a looping, muted, inline-playing background video", () => {
    const { container } = render(<BackgroundPlate />);

    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
  });

  it("points the video source at the public background asset", () => {
    const { container } = render(<BackgroundPlate />);

    const source = container.querySelector("video source");

    expect(source?.getAttribute("src")).toBe("/background.webm");
    expect(source?.getAttribute("type")).toBe("video/webm");
  });

  it("hides the decorative video from assistive tech and the tab order", () => {
    const { container } = render(<BackgroundPlate />);

    const wrapper = container.firstElementChild;
    const video = container.querySelector("video");

    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
    expect(video?.getAttribute("tabindex")).toBe("-1");
  });

  it("pins the plate to the viewport rather than stretching it over the document", () => {
    const { container } = render(<BackgroundPlate />);

    // The page scrolls OVER the plate. Stretching it to the content height
    // instead would re-crop the same `object-cover` frame per page length.
    expect(container.firstElementChild?.className).toContain("fixed");
  });

  // The scrim is a SIBLING rendered by the page, not a child of the plate:
  // the plate is mounted once in the root layout so a route change cannot
  // remount its <video>, and the scrim is the one part of it the artboards
  // vary per page.
  it("carries no scrim of its own — that belongs to the page", () => {
    const { container } = render(<BackgroundPlate />);

    expect(container.querySelector("video ~ div")).toBeNull();
  });
});

describe("PageScrim", () => {
  it("applies the landing scrim strength (75% black) by default", () => {
    const { container } = render(<PageScrim />);

    const scrim = container.firstElementChild as HTMLElement | null;

    expect(scrim?.style.backgroundColor).toBe("rgba(0, 0, 0, 0.75)");
  });

  it("accepts a caller-supplied scrim strength, e.g. the PDP's 70% black", () => {
    const { container } = render(<PageScrim scrim="#000000B3" />);

    const scrim = container.firstElementChild as HTMLElement | null;

    expect(scrim?.style.backgroundColor).toBe("rgba(0, 0, 0, 0.7)");
  });

  it("pins itself to the viewport and stays behind the page content", () => {
    const { container } = render(<PageScrim />);

    const scrim = container.firstElementChild;

    expect(scrim?.className).toContain("fixed");
    expect(scrim?.className).toContain("-z-9");
    expect(scrim?.getAttribute("aria-hidden")).toBe("true");
  });
});
