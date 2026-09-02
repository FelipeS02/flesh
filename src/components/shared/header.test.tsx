import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./header";

describe("Header", () => {
  it("renders a link to the homepage wrapping the wordmark", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /flesh/i });

    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders the FLESH wordmark svg inside that link", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /flesh/i });
    const svg = link.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 575 229");
  });

  it("places the wordmark link in the middle column of a 3-column grid, leaving the third column empty for a future cart trigger", () => {
    const { container } = render(<Header />);

    const header = container.querySelector("header");
    const link = screen.getByRole("link", { name: /flesh/i });

    expect(header?.children).toHaveLength(1);
    expect(header?.firstElementChild).toBe(link);
  });
});
