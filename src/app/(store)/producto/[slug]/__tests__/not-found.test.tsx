import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductNotFound from "../not-found";

describe("ProductNotFound", () => {
  it("names the page with one heading", () => {
    render(<ProductNotFound />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("points the one CTA at the drop, by the anchor the rest of the store uses", () => {
    render(<ProductNotFound />);

    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter((href) => href !== "/"),
    ).toEqual(["/#catalogo"]);
  });

  it("keeps the wordmark as the way home", () => {
    render(<ProductNotFound />);

    expect(
      screen.getByRole("link", { name: "FLESH inicio" }).getAttribute("href"),
    ).toBe("/");
  });

  it("covers the store's video plate with a solid ground", () => {
    const { container } = render(<ProductNotFound />);

    // Rendered inside the (store) layout, so the sitewide video still plays
    // behind this route; the artboard is flat black, and a skull over a moving
    // plate stops reading as one image.
    expect(container.querySelector("main")?.classList.contains("bg-background")).toBe(
      true,
    );
  });

  it("draws the skull as decoration only", () => {
    const { container } = render(<ProductNotFound />);

    const skull = container.querySelector('img[src*="password-illustration"]');

    expect(skull?.getAttribute("alt")).toBe("");
    expect(skull?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
