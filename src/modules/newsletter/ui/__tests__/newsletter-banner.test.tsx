import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCookieNoticeStorage } from "@/modules/legal/cookie-notice.storage";
import { BANNER_DELAY_MS, BANNER_DISMISS_MS } from "../../domain/banner-policy";
import { createBannerStorage } from "../banner-storage";
import { NewsletterBanner, NewsletterBannerPreload } from "../newsletter-banner";
import type { SubscribePort } from "../newsletter.client";

function memory(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
}

type Harness = {
  local: ReturnType<typeof memory>;
  session: ReturnType<typeof memory>;
  cookieBacking: ReturnType<typeof memory>;
};

function makeHarness(options: { cookieAcknowledged?: boolean } = {}): Harness {
  return {
    local: memory(),
    session: memory(),
    cookieBacking: memory(options.cookieAcknowledged === false ? {} : { "flesh.cookie-notice.v1": "1" }),
  };
}

function port(outcome: Awaited<ReturnType<SubscribePort["subscribe"]>> = { ok: true }) {
  const subscribe = vi.fn<SubscribePort["subscribe"]>().mockResolvedValue(outcome);

  return { subscribe } satisfies SubscribePort;
}

function mount(harness: Harness, subscribePort: SubscribePort = port()) {
  const cookieNotice = createCookieNoticeStorage(harness.cookieBacking);
  const storage = createBannerStorage({ local: harness.local, session: harness.session });
  const view = render(
    <NewsletterBanner port={subscribePort} storage={storage} cookieNotice={cookieNotice} />,
  );

  return { ...view, cookieNotice, storage, port: subscribePort };
}

function banner() {
  return screen.queryByRole("region", { name: "Newsletter" });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NewsletterBanner timing", () => {
  it("does not appear before the delay", () => {
    mount(makeHarness());

    advance(BANNER_DELAY_MS - 1);

    expect(banner()).toBeNull();
  });

  it("appears once the delay has elapsed", () => {
    mount(makeHarness());

    advance(BANNER_DELAY_MS);

    expect(banner()).not.toBeNull();
  });

  // The layout survives client navigations, so the clock cannot be the
  // component's lifetime: a remount (or a reload) continues the same session.
  it("keeps counting from the session start across a remount", () => {
    const harness = makeHarness();
    const first = mount(harness);

    advance(6_000);
    first.unmount();
    mount(harness);
    advance(BANNER_DELAY_MS - 6_000);

    expect(banner()).not.toBeNull();
  });

  it("renders nothing on the server", () => {
    const harness = makeHarness();

    expect(
      renderToStaticMarkup(
        <NewsletterBanner
          port={port()}
          storage={createBannerStorage({ local: harness.local, session: harness.session })}
          cookieNotice={createCookieNoticeStorage(harness.cookieBacking)}
        />,
      ),
    ).toBe("");
  });

  it("never appears for someone who already subscribed", () => {
    const harness = makeHarness();
    createBannerStorage({ local: harness.local, session: harness.session }).markSubscribed();
    mount(harness);

    advance(BANNER_DELAY_MS * 5);

    expect(banner()).toBeNull();
  });
});

describe("NewsletterBanner and the cookie notice", () => {
  it("stays away while the cookie notice is pending, however long that takes", () => {
    mount(makeHarness({ cookieAcknowledged: false }));

    advance(BANNER_DELAY_MS * 6);

    expect(banner()).toBeNull();
  });

  it("shows shortly after the notice is acknowledged, without owing the delay again", () => {
    const { cookieNotice } = mount(makeHarness({ cookieAcknowledged: false }));

    advance(BANNER_DELAY_MS * 6);
    act(() => cookieNotice.acknowledge());
    advance(0);

    expect(banner()).not.toBeNull();
  });

  it("still honours the delay when the notice is acknowledged early", () => {
    const { cookieNotice } = mount(makeHarness({ cookieAcknowledged: false }));

    advance(3_000);
    act(() => cookieNotice.acknowledge());
    advance(BANNER_DELAY_MS - 3_000 - 1);

    expect(banner()).toBeNull();

    advance(1);

    expect(banner()).not.toBeNull();
  });
});

describe("NewsletterBanner dismissal", () => {
  function open(harness = makeHarness()) {
    const view = mount(harness);
    advance(BANNER_DELAY_MS);

    return { ...view, harness };
  }

  it("closes on the X and remembers it", () => {
    const { storage } = open();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(banner()).toBeNull();
    expect(storage.dismissedAt()).toBe(Date.now());
  });

  it("stays away for 14 days after the X, then returns", () => {
    const { harness, unmount } = open();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    unmount();

    // New session, same browser: the dismissal outlives the tab.
    const later = { ...harness, session: memory() };
    vi.setSystemTime(Date.now() + BANNER_DISMISS_MS - 1_000);
    const second = mount(later);
    advance(BANNER_DELAY_MS);
    expect(banner()).toBeNull();
    second.unmount();

    vi.setSystemTime(Date.now() + 2_000);
    mount({ ...harness, session: memory() });
    advance(BANNER_DELAY_MS);
    expect(banner()).not.toBeNull();
  });

  it("closes on Escape only when focus is inside the banner", () => {
    open();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(banner()).not.toBeNull();

    fireEvent.keyDown(screen.getByLabelText("Email"), { key: "Escape" });
    expect(banner()).toBeNull();
  });

  it("does not take focus when it appears", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();

    open();

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

describe("NewsletterBanner as a non-modal strip", () => {
  it("is a labelled region, not a dialog, with no scrim", () => {
    mount(makeHarness());
    advance(BANNER_DELAY_MS);

    expect(banner()).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  // `SkullsBackdrop`'s stated contract, repeated here because nothing in the
  // DOM says it: at -z-1 the plate paints below an opaque parent unless that
  // parent opens its own stacking context.
  it("opens its own stacking context so the texture paints above the popover ground", () => {
    mount(makeHarness());
    advance(BANNER_DELAY_MS);

    expect(banner()?.className).toContain("isolate");
    expect(banner()?.className).toContain("overflow-hidden");
  });

  // The PDP's purchase widget publishes `--bottom-dock`; the banner must sit
  // on top of it and never cover the add-to-cart button.
  it("sits above whatever is docked at the bottom edge", () => {
    mount(makeHarness());
    advance(BANNER_DELAY_MS);

    expect(banner()?.className).toContain("bottom-[var(--bottom-dock,0px)]");
  });

  it("draws a decorative desktop and mobile texture, hidden from assistive tech", () => {
    mount(makeHarness());
    advance(BANNER_DELAY_MS);

    const picture = banner()?.querySelector("picture");
    const image = picture?.querySelector("img");

    expect(picture?.querySelector("source")?.getAttribute("media")).toBe("(min-width: 768px)");
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("NewsletterBanner submission", () => {
  function open(subscribePort?: SubscribePort) {
    const view = mount(makeHarness(), subscribePort);
    advance(BANNER_DELAY_MS);

    return view;
  }

  it("asks for an email through a labelled, typed field", () => {
    open();

    const input = screen.getByLabelText("Email") as HTMLInputElement;

    expect(input.type).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.placeholder).toBe("EMAIL");
  });

  it("subscribes through the port and confirms where the welcome went", async () => {
    const view = open();

    await submit("fan@flesh.test");

    expect(view.port.subscribe).toHaveBeenCalledWith("fan@flesh.test");
    expect(screen.getByRole("heading", { name: "YA ESTÁS ADENTRO" })).toBeDefined();
    expect(screen.getByText("Te mandamos la bienvenida a fan@flesh.test")).toBeDefined();
  });

  it("remembers the subscription as soon as it succeeds, so a reload cannot show it again", async () => {
    const view = open();

    await submit("fan@flesh.test");

    expect(view.storage.subscribed()).toBe(true);
  });

  it("closes itself 4 seconds after the confirmation", async () => {
    open();

    await submit("fan@flesh.test");
    advance(3_999);
    expect(banner()).not.toBeNull();

    advance(1);
    expect(banner()).toBeNull();
  });

  it("disables the button and says so while the request is in flight", async () => {
    let resolve!: (value: { ok: true }) => void;
    const pending = new Promise<{ ok: true }>((done) => (resolve = done));
    open({ subscribe: vi.fn(() => pending) });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
    });

    const sending = screen.getByRole("button", { name: "Enviando…" }) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);

    await act(async () => resolve({ ok: true }));
  });

  it("flags an invalid email on the field and in an alert", async () => {
    open(port({ ok: false, error: "invalid-email" }));

    await submit("nope");

    expect(screen.getByRole("alert").textContent).toContain("REVISÁ EL EMAIL, LE FALTA ALGO.");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(banner()).not.toBeNull();
  });

  it("offers a retry when the service is unavailable, keeping what was typed", async () => {
    open(port({ ok: false, error: "unavailable" }));

    await submit("fan@flesh.test");

    expect(screen.getByRole("alert").textContent).toContain("NO PUDIMOS ANOTARTE. PROBÁ DE NUEVO.");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("fan@flesh.test");
    expect((screen.getByRole("button", { name: "Suscribirme" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("clears the error when the shopper retries", async () => {
    const subscribe = vi
      .fn<SubscribePort["subscribe"]>()
      .mockResolvedValueOnce({ ok: false, error: "unavailable" })
      .mockResolvedValueOnce({ ok: true });
    open({ subscribe });

    await submit("fan@flesh.test");
    await submit("fan@flesh.test");

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("states what subscribing means, and that it is not needed to buy", () => {
    open();

    expect(
      screen.getByText(/NO HACE FALTA PARA COMPRAR\. TE DAS DE BAJA DESDE CUALQUIER EMAIL\./),
    ).toBeDefined();
  });
});

describe("NewsletterBannerPreload", () => {
  it("offers the same candidates the banner's textures request, per breakpoint", () => {
    mount(makeHarness());
    advance(BANNER_DELAY_MS);

    const view = render(<NewsletterBannerPreload />);
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')];
    const sources = [...(banner()?.querySelectorAll("source") ?? [])];
    const image = banner()?.querySelector("img");

    const desktop = links.find((link) => link.getAttribute("media") === "(min-width: 768px)");
    const mobile = links.find((link) => link.getAttribute("media") === "(max-width: 767px)");

    expect(desktop?.getAttribute("imagesrcset")).toBe(sources[0]?.getAttribute("srcset"));
    expect(mobile?.getAttribute("imagesrcset")).toBe(image?.getAttribute("srcset"));
    view.unmount();
  });
});
