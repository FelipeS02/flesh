import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReturnsPolicy, WHATSAPP } from "./returns-policy";

describe("ReturnsPolicy", () => {
  it("states the final-sale rule wherever it is rendered", () => {
    const { container } = render(<ReturnsPolicy />);

    expect(container.textContent).toContain("todas las ventas son finales");
    expect(container.textContent).toContain("Tenés 7 días desde la entrega");
    expect(container.textContent).toContain(
      "Pasados los 7 días no podemos procesar el reclamo",
    );
  });

  // The sentence is a POINTER ("acá arriba"), and a pointer is only true
  // where it points at something. Off the PDP it would send a reader up the
  // page towards a header.
  it("omits the size-guide pointer by default", () => {
    const { container } = render(<ReturnsPolicy />);

    expect(container.textContent).not.toContain("acá arriba");
    expect(container.textContent).not.toContain("escala de calce");
  });

  it("adds the size-guide pointer where the guide really is above it", () => {
    const { container } = render(<ReturnsPolicy sizeGuideNearby />);

    expect(container.textContent).toContain(
      "La tabla de talles y la escala de calce están acá arriba",
    );
  });

  it("keeps the sentence readable when the pointer is appended", () => {
    const { container } = render(<ReturnsPolicy sizeGuideNearby />);

    // No missing space where the two halves meet — JSX drops the newline
    // between a text node and the expression that follows it.
    expect(container.textContent).toContain("compra. La tabla de talles");
  });

  it("links the claims channel to wa.me and prints the human-readable number", () => {
    render(<ReturnsPolicy />);

    const link = screen.getByRole("link", { name: WHATSAPP.display });

    expect(link.getAttribute("href")).toBe(WHATSAPP.href);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("lets a caller replace the type scale for a page that is only this copy", () => {
    const { container } = render(<ReturnsPolicy className="text-sm md:text-base" />);

    const root = container.firstElementChild;

    expect(root?.className).toContain("text-sm");
    expect(root?.className).not.toContain("text-xs");
  });
});
