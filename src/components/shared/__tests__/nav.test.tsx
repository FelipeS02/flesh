import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav, NAV_ITEMS } from "../nav";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

// Every query below resolves its accessible name through NAV_ITEMS rather than
// repeating the copy: these labels are shopper-facing Spanish that gets
// reworded — one added accent already turned three of these red — and what the
// assertions are about is the nav's behaviour, not its wording.
const label = {
  catalogo: NAV_ITEMS[0].label,
  instagram: NAV_ITEMS[1].label,
  devolucion: NAV_ITEMS[2].label,
  playlist: NAV_ITEMS[3].label,
} as const;

describe("Nav", () => {
  it("exposes exactly four nav items, in the designed order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Catálogo",
      "Instagram",
      "Devolución",
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

    const instagram = screen.getByRole("link", { name: label.instagram });
    const playlist = screen.getByRole("link", { name: label.playlist });

    expect(instagram.getAttribute("target")).toBe("_blank");
    expect(instagram.getAttribute("rel")).toBe("noopener noreferrer");
    expect(playlist.getAttribute("target")).toBe("_blank");
    expect(playlist.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does NOT mark internal links (Catálogo, Devolución) with target or rel", () => {
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: label.catalogo });
    const devolucion = screen.getByRole("link", { name: label.devolucion });

    expect(catalogo.getAttribute("target")).toBeNull();
    expect(catalogo.getAttribute("rel")).toBeNull();
    expect(devolucion.getAttribute("target")).toBeNull();
    expect(devolucion.getAttribute("rel")).toBeNull();
  });

  it("marks Catálogo active only on the root pathname", () => {
    route.pathname = "/";
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: label.catalogo });
    const devolucion = screen.getByRole("link", { name: label.devolucion });

    expect(catalogo.className).toContain("text-primary");
    expect(catalogo.getAttribute("aria-current")).toBe("page");
    expect(devolucion.className).toContain("text-foreground");
    expect(devolucion.getAttribute("aria-current")).toBeNull();
  });

  it("marks Devolucion active on /devoluciones and never marks external links active", () => {
    route.pathname = "/devoluciones";
    render(<Nav />);

    const catalogo = screen.getByRole("link", { name: label.catalogo });
    const devolucion = screen.getByRole("link", { name: label.devolucion });
    const instagram = screen.getByRole("link", { name: label.instagram });
    const playlist = screen.getByRole("link", { name: label.playlist });

    expect(catalogo.className).toContain("text-foreground");
    expect(devolucion.className).toContain("text-primary");
    expect(devolucion.getAttribute("aria-current")).toBe("page");
    [instagram, playlist].forEach((link) => {
      expect(link.className).toContain("text-foreground");
      expect(link.getAttribute("aria-current")).toBeNull();
    });
  });
});
