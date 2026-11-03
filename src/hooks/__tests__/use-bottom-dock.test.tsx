import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { installControllableResizeObserver } from "../../../test/fixtures/observers";
import { BOTTOM_DOCK_PROPERTY, useBottomDock } from "../use-bottom-dock";

function Dock({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useBottomDock(ref, active);

  return <div ref={ref} data-testid="dock" />;
}

let height = 0;
let resize: ReturnType<typeof installControllableResizeObserver>;
let descriptor: PropertyDescriptor | undefined;

function published(): string {
  return document.documentElement.style.getPropertyValue(BOTTOM_DOCK_PROPERTY);
}

beforeEach(() => {
  height = 96;
  resize = installControllableResizeObserver();
  descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
});

afterEach(() => {
  resize.restore();
  if (descriptor) Object.defineProperty(HTMLElement.prototype, "offsetHeight", descriptor);
  document.documentElement.style.removeProperty(BOTTOM_DOCK_PROPERTY);
});

describe("useBottomDock", () => {
  it("publishes the element's height on the document while active", () => {
    render(<Dock active />);

    expect(published()).toBe("96px");
  });

  it("follows the element when it resizes", () => {
    render(<Dock active />);

    height = 140;
    resize.trigger();

    expect(published()).toBe("140px");
  });

  // Anything that sits above the dock reads this value; a stale 96px left
  // behind by a widget that slid away would float it above empty space.
  it("clears the property when the dock stops being active", () => {
    const { rerender } = render(<Dock active />);

    rerender(<Dock active={false} />);

    expect(published()).toBe("");
    expect(resize.observing()).toBe(0);
  });

  it("clears the property when the dock unmounts", () => {
    const { unmount } = render(<Dock active />);

    unmount();

    expect(published()).toBe("");
    expect(resize.observing()).toBe(0);
  });

  it("publishes nothing while inactive", () => {
    render(<Dock active={false} />);

    expect(published()).toBe("");
  });
});
