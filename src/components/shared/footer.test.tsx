import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";
import { NAV_ITEMS } from "./nav";

describe("Footer", () => {
  it("renders the footer landmark", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).not.toBeNull();
  });

  it("uses the mobile full-bleed class contract while restoring wrapped desktop layout", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo").className).toContain(
      "w-screen",
    );
    expect(screen.getByRole("contentinfo").className).toContain(
      "left-1/2",
    );
    expect(screen.getByRole("contentinfo").className).toContain(
      "-translate-x-1/2",
    );
    expect(screen.getByRole("contentinfo").className).toContain("md:w-auto");
    expect(screen.getByRole("contentinfo").className).toContain("md:left-auto");
    expect(screen.getByRole("contentinfo").className).toContain(
      "md:translate-x-0",
    );
  });

  it("wraps Nav — all nav items render inside the footer landmark", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    const links = footer.querySelectorAll("a");

    expect(Array.from(links).map((link) => link.textContent)).toEqual(
      NAV_ITEMS.map((item) => item.label),
    );
  });
});
