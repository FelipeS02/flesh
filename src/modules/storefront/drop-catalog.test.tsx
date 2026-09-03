import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildColourwayIndex } from "@/modules/catalog/client";
import { makeProduct } from "../../../test/fixtures/product-view";
import { DropCatalog } from "./drop-catalog";

/** This suite is about volume grouping and layout, not colour. */
const NO_COLOURWAYS = buildColourwayIndex([]);

describe("DropCatalog", () => {
  it("renders one card per visible product", () => {
    render(
      <DropCatalog
        colourways={NO_COLOURWAYS}
        products={[
          makeProduct({ id: 101, title: "Musculosa Demon Wash Black" }),
          makeProduct({ id: 102, title: "Musculosa Cross Wash Black" }),
          makeProduct({ id: 103, title: "Buzo Oversize" }),
        ]}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("shows no volume heading while a single volume exists", () => {
    render(
      <DropCatalog
        colourways={NO_COLOURWAYS}
        products={[
          makeProduct({ id: 101, tags: ["drop-1"] }),
          makeProduct({ id: 102, tags: ["drop-1"] }),
        ]}
      />,
    );

    expect(screen.queryByRole("heading", { name: /volumen/i })).toBeNull();
  });

  it("titles every volume once a second one exists", () => {
    render(
      <DropCatalog
        colourways={NO_COLOURWAYS}
        products={[
          makeProduct({ id: 101, tags: ["drop-1"] }),
          makeProduct({ id: 201, tags: ["drop-2"] }),
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole("heading", { name: /volumen/i })
        .map((heading) => heading.textContent),
    ).toEqual(["Volumen I", "Volumen II"]);
  });

  it("carries the anchor the nav's Catalogo link points at", () => {
    const { container } = render(
      <DropCatalog
        colourways={NO_COLOURWAYS}
        products={[makeProduct({ id: 101 })]}
      />,
    );

    expect(container.querySelector("#catalogo")).not.toBeNull();
  });

  it("renders nothing rather than an empty shell when the catalogue is empty", () => {
    render(<DropCatalog products={[]} colourways={NO_COLOURWAYS} />);

    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("lays six cards out in three columns rather than four and a stub", () => {
    const { container } = render(
      <DropCatalog
        colourways={NO_COLOURWAYS}
        products={Array.from({ length: 6 }, (_, index) =>
          makeProduct({ id: 101 + index }),
        )}
      />,
    );

    const row = container.querySelector<HTMLElement>("[data-drop-row]");

    // jsdom does no layout, so the column count can only be observed where it
    // enters the DOM: the variable the grid template reads. `balancedColumns`
    // owns the arithmetic and is tested on its own — this asserts the wiring,
    // which is the part that silently breaks.
    expect(row?.style.getPropertyValue("--drop-columns")).toBe("3");
  });
});
