import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StageMetrics } from "../stage-metrics";

let bandHeight = 0;
const root = document.documentElement;

function mountChrome(): void {
  const band = document.createElement("div");
  band.setAttribute("data-header-band", "");
  band.getBoundingClientRect = () => ({ height: bandHeight }) as DOMRect;

  const widget = document.createElement("div");
  widget.setAttribute("data-purchase-widget", "");
  widget.getBoundingClientRect = () => ({ height: 150 }) as DOMRect;

  document.body.append(band, widget);
}

function resizeTo(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

describe("StageMetrics", () => {
  beforeEach(() => {
    resizeTo(390, 664);
    bandHeight = 104;
    mountChrome();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    root.style.removeProperty("--pdp-band-height");
    root.style.removeProperty("--pdp-widget-height");
  });

  it("publishes both heights on mount", () => {
    render(<StageMetrics />);

    expect(root.style.getPropertyValue("--pdp-band-height")).toBe("104px");
    expect(root.style.getPropertyValue("--pdp-widget-height")).toBe("150px");
  });

  it("keeps the band height when a height-only resize fires mid-scroll", () => {
    render(<StageMetrics />);

    // iOS collapses its toolbar on scroll and reports it as a resize, by which
    // time the marquee has already folded into the band.
    bandHeight = 72;
    resizeTo(390, 750);

    expect(root.style.getPropertyValue("--pdp-band-height")).toBe("104px");
  });

  it("re-measures when the width changes", () => {
    render(<StageMetrics />);

    bandHeight = 90;
    resizeTo(844, 390);

    expect(root.style.getPropertyValue("--pdp-band-height")).toBe("90px");
  });
});
