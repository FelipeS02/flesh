import { describe, expect, it } from "vitest";
import { widgetVisible } from "./widget-visibility";

const VIEWPORT = 844;

describe("widgetVisible", () => {
  it("shows the widget while the panel is still below the fold", () => {
    expect(widgetVisible(900, VIEWPORT)).toBe(true);
  });

  it("keeps the widget while the panel sits in the lower half", () => {
    expect(widgetVisible(500, VIEWPORT)).toBe(true);
  });

  it("hides the widget once the panel's top edge passes the middle", () => {
    expect(widgetVisible(400, VIEWPORT)).toBe(false);
  });

  it("hides the widget when the panel has scrolled off the top", () => {
    expect(widgetVisible(-1200, VIEWPORT)).toBe(false);
  });

  it("treats the midpoint itself as crossed, so the boundary has one answer", () => {
    expect(widgetVisible(VIEWPORT / 2, VIEWPORT)).toBe(false);
  });
});
