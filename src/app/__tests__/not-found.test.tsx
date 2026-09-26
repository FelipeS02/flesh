import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "../not-found";

describe("NotFound (general)", () => {
  it("names the page with one heading", () => {
    render(<NotFound />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Te perdiste",
    );
  });

  it("reads the numeral as 404, not as two fours and an image", () => {
    render(<NotFound />);

    // The skull stands in for the zero, so without a label the numeral would
    // be announced as "4 4" with a nameless picture in between.
    expect(screen.getByRole("img", { name: "404" })).not.toBeNull();
  });

  it("sends the shopper home from the CTA and from the wordmark", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "FLESH inicio" }).getAttribute("href"),
    ).toBe("/");
  });

  it("keeps the skull out of the accessibility tree", () => {
    const { container } = render(<NotFound />);

    const skull = container.querySelector('img[src*="password-illustration"]');

    expect(skull).not.toBeNull();
    expect(skull?.getAttribute("alt")).toBe("");
  });
});
