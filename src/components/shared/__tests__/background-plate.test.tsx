import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { setReducedMotion } from "../../../../test/fixtures/viewport";
import { BackgroundPlate, PageScrim } from "../background-plate";

/**
 * jsdom reports a document that has already finished loading, which is the one
 * state in which the plate's deferral is invisible. A test that cares about the
 * wait has to put the document back into `loading` first.
 */
function setReadyState(value: DocumentReadyState): void {
  Object.defineProperty(document, "readyState", { value, configurable: true });
}

afterEach(() => setReadyState("complete"));

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

  it("paints a poster so the plate is never a black hole while the video loads", () => {
    const { container } = render(<BackgroundPlate />);

    const video = container.querySelector("video");

    expect(video?.getAttribute("poster")).toBe("/background-poster.webp");
  });

  it("holds the video back while the document is still loading", () => {
    setReadyState("loading");

    const { container } = render(<BackgroundPlate />);

    const video = container.querySelector("video");

    // The poster is already up, but not one byte of video has been asked for.
    // An autoplaying <video> is an LCP candidate, so fetching it alongside the
    // page put a multi-megabyte download on the critical path and reported an
    // 11s LCP against a page that was visually done in one.
    expect(video?.getAttribute("poster")).toBe("/background-poster.webp");
    expect(video?.hasAttribute("src")).toBe(false);
  });

  it("starts the video once the document has finished loading", () => {
    setReadyState("loading");

    const { container } = render(<BackgroundPlate />);

    act(() => {
      setReadyState("complete");
      window.dispatchEvent(new Event("load"));
    });

    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "/background.webm",
    );
  });

  it("starts the video immediately when the document had already loaded", () => {
    const { container } = render(<BackgroundPlate />);

    // `load` fires once per document. A plate mounted after it — which is every
    // mount under Fast Refresh, and every one in this suite — would otherwise
    // wait for an event that is never coming and sit on its poster forever.
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "/background.webm",
    );
  });

  it("never fetches the video for a viewer who asked for reduced motion", () => {
    setReducedMotion(true);

    const { container } = render(<BackgroundPlate />);

    // `motion-reduce:hidden` only stops the video being PAINTED; a browser
    // downloads the source of a `display: none` video all the same. Declining
    // to set `src` at all is what actually spares those viewers the bytes.
    expect(container.querySelector("video")?.hasAttribute("src")).toBe(false);
  });

  // The video's own wrapper, not `container.firstElementChild`. The scrim is
  // rendered first and is also `fixed` and also `aria-hidden`, so the three
  // assertions below all passed against the wrong element until they asked
  // for the video's parent by name.
  const plateOf = (container: HTMLElement) =>
    container.querySelector("video")?.parentElement;

  it("hides the decorative video from assistive tech and the tab order", () => {
    const { container } = render(<BackgroundPlate />);

    expect(plateOf(container)?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("video")?.getAttribute("tabindex")).toBe(
      "-1",
    );
  });

  it("pins the plate to the viewport rather than stretching it over the document", () => {
    const { container } = render(<BackgroundPlate />);

    // The page scrolls OVER the plate. Stretching it to the content height
    // instead would re-crop the same `object-cover` frame per page length.
    expect(plateOf(container)?.className).toContain("fixed");
  });

  // The plate owns the scrim so no page has to remember to add one — and so
  // that none adds a SECOND one. Two stacked `#00000070` layers composite to
  // ~69% black instead of ~44%, which is what `/devoluciones` was rendering.
  it("carries exactly one scrim, behind the page content", () => {
    const { container } = render(<BackgroundPlate />);

    const scrims = container.querySelectorAll("[data-page-scrim]");

    expect(scrims).toHaveLength(1);
    // Over the video, under everything the page paints.
    expect(scrims[0]?.className).toContain("-z-9");
  });
});

describe("PageScrim", () => {
  it("pins itself to the viewport and stays behind the page content", () => {
    const { container } = render(<PageScrim />);

    const scrim = container.firstElementChild;

    expect(scrim?.className).toContain("fixed");
    expect(scrim?.className).toContain("-z-9");
    expect(scrim?.getAttribute("aria-hidden")).toBe("true");
  });
});
