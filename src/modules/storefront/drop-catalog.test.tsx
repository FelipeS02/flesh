import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeProduct } from "../../../test/fixtures/product-view";
import { DropCatalog } from "./drop-catalog";

describe("DropCatalog", () => {
  it("renders one card per visible product", () => {
    render(
      <DropCatalog
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
      <DropCatalog products={[makeProduct({ id: 101 })]} />,
    );

    expect(container.querySelector("#catalogo")).not.toBeNull();
  });

  it("renders nothing rather than an empty shell when the catalogue is empty", () => {
    render(<DropCatalog products={[]} />);

    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });
});
