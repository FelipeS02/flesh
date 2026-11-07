import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import UnsubscribePage, { metadata } from "../page";

describe("/newsletter/baja page", () => {
  it("is kept out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("reads the token from the awaited searchParams and starts unsubscribing in the client", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const element = await UnsubscribePage({ searchParams: Promise.resolve({ token: "abc" }) });
    render(element);

    expect(fetchMock).toHaveBeenCalledWith("/api/newsletter/unsubscribe?token=abc", expect.anything());
    vi.unstubAllGlobals();
  });

  it("passes no token when the parameter is absent or repeated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(await UnsubscribePage({ searchParams: Promise.resolve({}) }));
    render(await UnsubscribePage({ searchParams: Promise.resolve({ token: ["a", "b"] }) }));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
