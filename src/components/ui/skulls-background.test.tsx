import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SkullsBackdrop, SkullsBackgroundPreload } from "./skulls-background";

function preloadLink(): HTMLLinkElement {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="preload"][as="image"]',
  );

  if (!link) throw new Error("Expected the skulls background preload link");

  return link;
}

describe("SkullsBackgroundPreload", () => {
  // The same invariant `sheet-background.test.tsx` guards, for the same
  // reason: a preload that resolves to a different candidate than the `<img>`
  // still downloads, so nothing fails loudly — it just warms a resource the
  // toast never asks for, and the plate fades in after the toast arrives.
  it("offers the browser the same candidates the backdrop requests", () => {
    const { container } = render(
      <>
        <SkullsBackgroundPreload />
        <SkullsBackdrop />
      </>,
    );

    const image = container.querySelector("img");
    if (!image) throw new Error("Expected the backdrop image");

    const link = preloadLink();

    expect(link.getAttribute("imagesrcset")).toBe(image.getAttribute("srcset"));
    expect(link.getAttribute("imagesizes")).toBe(image.getAttribute("sizes"));
  });

  // Decorative, and the toast already carries its own announcement: the plate
  // must never reach the polite live region `Toast.Viewport` renders.
  it("keeps the plate out of the accessibility tree", () => {
    const { container } = render(<SkullsBackdrop />);

    const image = container.querySelector("img");

    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("aria-hidden")).toBe("true");
  });
});
