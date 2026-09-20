import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeProduct, makeVariant } from "../../../../test/fixtures/product-view";
import {
  CatalogViewTracker,
  ProductAnalyticsLink,
  ProductViewTracker,
} from "../catalog-trackers";

describe("catalog analytics trackers", () => {
  it("emits one list impression with the displayed products", () => {
    const send = vi.fn();
    const products = [
      makeProduct({
        title: "Remera A",
        variants: [makeVariant({ id: 201, combination: ["M"] })],
      }),
      makeProduct({ title: "Remera B", variants: [makeVariant({ id: 202 })] }),
    ];

    const view = render(<CatalogViewTracker products={products} send={send} />);
    view.rerender(<CatalogViewTracker products={products} send={send} />);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      name: "view_item_list",
      params: {
        items: [
          { item_id: "201", item_name: "Remera A (M)" },
          { item_id: "202", item_name: "Remera B" },
        ],
      },
    });
  });

  it("emits one product view for the selected variant", () => {
    const send = vi.fn();
    const product = makeProduct({
      title: "Remera PDP",
      variants: [makeVariant({ sku: "PDP-M" })],
    });

    render(<ProductViewTracker product={product} send={send} />);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "view_item" }),
    );
  });

  it("emits select_item only when the shopper clicks the real link", () => {
    const send = vi.fn();
    const product = makeProduct({ variants: [makeVariant({ sku: "CARD-M" })] });

    render(
      <ProductAnalyticsLink href="/producto/tee" product={product} send={send}>
        Ver producto
      </ProductAnalyticsLink>,
    );

    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Ver producto" }));
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "select_item" }),
    );
  });
});
