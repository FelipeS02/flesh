import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav, NAV_ITEMS } from "./nav";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

describe("Nav", () => {
  it("exposes exactly four nav items, in the designed order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Catalogo",
      "Instagram",
      "Devolucion",
      "Playlist",
    ]);
  });

  it("renders one link per item, in the exact designed order", () => {
    render(<Nav />);

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual(
      NAV_ITEMS.map((item) => item.label),
    );
  });

  it("renders each link with its configured href", () => {
    render(<Nav />);

    const links = screen.getAllByRole("link");

    links.forEach((link, index) => {
      expect(link.getAttribute("href")).toBe(NAV_ITEMS[index].href);
    });
  });

  it("renders exactly four links — no duplication across responsive layouts", () => {
    render(<Nav />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("marks external links (Instagram, Playlist) with target=_blank and rel=noopener noreferrer", () => {
    render(<Nav />);

    const instagram = screen.getByRole("link", { name: "Instagram" });
    const playlist = screen.getByRole("link", { name: "Playlist" });

    expect(instagram.getAttribute("target")).toBe("_blank");
    expect(instagram.getAttribute("rel")).toBe("noopener noreferrer");
    expect(playlist.getAttribute("target")).toBe("_blank");
    expect(playlist.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does NOT mark internal links (Catalogo, Devolucion) with target or rel", () => {
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: "Catalogo" });
    const devolucion = screen.getByRole("link", { name: "Devolucion" });

    expect(catalogo.getAttribute("target")).toBeNull();
    expect(catalogo.getAttribute("rel")).toBeNull();
    expect(devolucion.getAttribute("target")).toBeNull();
    expect(devolucion.getAttribute("rel")).toBeNull();
  });

  it("marks Catalogo active only on the root pathname", () => {
    route.pathname = "/";
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: "Catalogo" });
    const devolucion = screen.getByRole("link", { name: "Devolucion" });

    expect(catalogo.className).toContain("text-primary");
    expect(catalogo.getAttribute("aria-current")).toBe("page");
    expect(devolucion.className).toContain("text-foreground");
    expect(devolucion.getAttribute("aria-current")).toBeNull();
  });

  it("marks Devolucion active on /devoluciones and never marks external links active", () => {
    route.pathname = "/devoluciones";
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: "Catalogo" });
    const devolucion = screen.getByRole("link", { name: "Devolucion" });
    const instagram = screen.getByRole("link", { name: "Instagram" });
    const playlist = screen.getByRole("link", { name: "Playlist" });

    expect(catalogo.className).toContain("text-foreground");
    expect(devolucion.className).toContain("text-primary");
    expect(devolucion.getAttribute("aria-current")).toBe("page");
    [instagram, playlist].forEach((link) => {
      expect(link.className).toContain("text-foreground");
      expect(link.getAttribute("aria-current")).toBeNull();
    });
  });
});
