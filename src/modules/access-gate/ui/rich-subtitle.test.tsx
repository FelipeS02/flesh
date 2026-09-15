import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichSubtitle } from "./rich-subtitle";

describe("RichSubtitle", () => {
  it("renders the bold run inside a <strong> element", () => {
    render(<RichSubtitle text="SITIO EN **CONSTRUCCIÓN**" />);

    const strong = screen.getByText("CONSTRUCCIÓN");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders a forged marker payload as text, never markup", () => {
    const payload = '**<img src=x onerror="window.__richTextXss = true">**';

    render(<RichSubtitle text={payload} />);

    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(window).not.toHaveProperty("__richTextXss");
  });
});
