import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundPlate } from "./background-plate";

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

  it("applies the landing scrim strength (75% black) by default", () => {
    const { container } = render(<BackgroundPlate />);

    const scrim = container.querySelector("video ~ div") as HTMLElement | null;

    expect(scrim?.style.backgroundColor).toBe("rgba(0, 0, 0, 0.75)");
  });

  it("accepts a caller-supplied scrim strength, e.g. the PDP's 70% black", () => {
    const { container } = render(<BackgroundPlate scrim="#000000B3" />);

    const scrim = container.querySelector("video ~ div") as HTMLElement | null;

    expect(scrim?.style.backgroundColor).toBe("rgba(0, 0, 0, 0.7)");
  });
});
