import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageViewTracker } from "../page-view-tracker";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("PageViewTracker", () => {
  it("emits once initially and once for each changed pathname", () => {
    const send = vi.fn();
    const view = render(<PageViewTracker send={send} />);

    expect(send).toHaveBeenCalledWith({
      name: "page_view",
      params: { page_path: "/" },
    });

    pathname = "/producto/tee";
    view.rerender(<PageViewTracker send={send} />);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({
      name: "page_view",
      params: { page_path: "/producto/tee" },
    });
  });

  it("does not emit when only query state changes", () => {
    pathname = "/producto/tee";
    const send = vi.fn();
    const view = render(<PageViewTracker send={send} />);

    // usePathname intentionally returns the same value for ?talle=m and
    // ?talle=l; rerendering represents nuqs changing that query state.
    view.rerender(<PageViewTracker send={send} />);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
