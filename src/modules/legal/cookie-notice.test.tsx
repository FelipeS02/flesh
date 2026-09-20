import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { CookieNotice } from "./cookie-notice";
import {
  createCookieNoticeStorage,
  type CookieNoticeStorage,
} from "./cookie-notice.storage";

function fakeStorage(acknowledged: boolean): CookieNoticeStorage & {
  acknowledge: ReturnType<typeof vi.fn>;
} {
  let state = acknowledged;
  const acknowledge = vi.fn(() => {
    state = true;
  });

  return { acknowledged: () => state, acknowledge };
}

function notice() {
  return screen.queryByRole("region", { name: "Política de cookies" });
}

describe("CookieNotice", () => {
  it("shows the notice to a shopper who has not acknowledged it", () => {
    render(<CookieNotice storage={fakeStorage(false)} />);

    expect(notice()).not.toBeNull();
  });

  it("stays away once it has been acknowledged", () => {
    render(<CookieNotice storage={fakeStorage(true)} />);

    expect(notice()).toBeNull();
  });

  // The server has no `localStorage`, so it cannot know the answer. Emitting
  // the notice there and letting the client take it away is a hydration
  // mismatch AND a flash of a panel at every shopper who dismissed it long
  // ago; emitting nothing is the third option the `undecided` state exists
  // for. Asserted against the server renderer because that first pass is the
  // only place the bug can live — by the time RTL can query, the effect has
  // already answered.
  it("renders nothing at all on the server", () => {
    expect(renderToStaticMarkup(<CookieNotice storage={fakeStorage(false)} />)).toBe(
      "",
    );
  });

  it("dismisses on the close control and records the acknowledgement", () => {
    const storage = fakeStorage(false);

    render(<CookieNotice storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(notice()).toBeNull();
    expect(storage.acknowledge).toHaveBeenCalledTimes(1);
  });

  // A browser with site data blocked is a real configuration, and this is
  // the composition that ships: the REAL adapter over a backing that throws
  // on both operations. Injecting a port that throws instead would be
  // testing an implementation the contract forbids — and the component does
  // not defend against one, by design. The guarantee lives in the adapter,
  // in one place, and this proves the pair actually holds it.
  it("dismisses normally when the browser blocks site data", () => {
    const blocked = createCookieNoticeStorage({
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });

    render(<CookieNotice storage={blocked} />);

    // Unreadable storage answers "not acknowledged", so the notice shows.
    expect(notice()).not.toBeNull();

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" })),
    ).not.toThrow();
    expect(notice()).toBeNull();
  });

  // `SkullsBackdrop` sits at `-z-1` and states the requirement in its own
  // doc: without a stacking context on this panel the plate paints beneath
  // the opaque background. The cart toast shipped that bug once — it showed
  // only while the entrance animation held opacity below 1 — and nothing in
  // the DOM says so on its own.
  it("paints the decorative plate inside its own stacking context", () => {
    render(<CookieNotice storage={fakeStorage(false)} />);

    const panel = notice();

    expect(panel?.querySelector('img[aria-hidden="true"]')).not.toBeNull();
    expect(panel?.className).toContain("isolate");
    expect(panel?.className).toContain("overflow-hidden");
  });
});
