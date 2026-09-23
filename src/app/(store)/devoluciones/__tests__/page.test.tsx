import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// Both reach for cart state this page never uses, and neither has anything to
// do with what is being asserted here: the page's own composition.
vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", () => ({ Footer: () => null }));

const { default: ReturnsPage } = await import("../page");

describe("ReturnsPage", () => {
  it("draws a second scrim over the sitewide one", () => {
    const { container } = render(<ReturnsPage />);

    // Exactly one HERE, which lands on top of the plate's: two #00000070
    // layers composite to ~69% black instead of ~44%. That extra darkening is
    // the point — this page is policy prose over a moving video. Pinned
    // because it reads like a duplicate and is the first thing a cleanup
    // would delete.
    expect(container.querySelectorAll("[data-page-scrim]")).toHaveLength(1);
  });
});
