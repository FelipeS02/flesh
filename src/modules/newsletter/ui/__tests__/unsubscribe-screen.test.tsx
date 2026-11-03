import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { UnsubscribeScreen } from "../unsubscribe-screen";

const TOKEN = "7b1d6f0e-2c1a-4a58-9d3e-5a1f0c2b9e11";

function stubFetch(...statuses: (number | Error)[]) {
  const queue = [...statuses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift() ?? 204;
    if (next instanceof Error) throw next;
    return new Response(null, { status: next });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("UnsubscribeScreen", () => {
  it("never calls fetch while rendering on the server: only the client effect mutates", () => {
    // Mail link scanners and prefetchers GET every link but do not run
    // JavaScript. If the render itself unsubscribed, they would unsubscribe
    // every recipient before they ever opened the email.
    const fetchMock = stubFetch();

    const html = renderToString(<UnsubscribeScreen token={TOKEN} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain("Dándote de baja");
  });

  it("shows the pending state with no body and no CTA until the request settles", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));

    render(<UnsubscribeScreen token={TOKEN} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dándote de baja…");
    expect(screen.queryByRole("link", { name: "Volver a la tienda" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    resolve(new Response(null, { status: 204 }));
    await screen.findByRole("heading", { name: "Te diste de baja" });
  });

  it("POSTs the token to the unsubscribe endpoint once on mount", async () => {
    const fetchMock = stubFetch(204);

    render(<UnsubscribeScreen token={TOKEN} />);
    await screen.findByRole("heading", { name: "Te diste de baja" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/newsletter/unsubscribe?token=${TOKEN}`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("confirms the unsubscribe and offers the way back to the store and to re-subscribe", async () => {
    stubFetch(204);

    render(<UnsubscribeScreen token={TOKEN} />);

    await screen.findByRole("heading", { name: "Te diste de baja" });
    expect(
      screen.getByText("No te vamos a escribir más novedades. Si fue sin querer, te anotás de nuevo en un click."),
    ).not.toBeNull();
    const links = screen.getAllByRole("link", { name: "Volver a la tienda" });
    expect(links.at(-1)?.getAttribute("href")).toBe("/");
    expect(screen.getByRole("button", { name: "ME ARREPENTÍ, ANOTARME DE NUEVO" })).not.toBeNull();
  });

  it("re-subscribes through the resubscribe endpoint and says so", async () => {
    const fetchMock = stubFetch(204, 204);

    render(<UnsubscribeScreen token={TOKEN} />);
    fireEvent.click(await screen.findByRole("button", { name: "ME ARREPENTÍ, ANOTARME DE NUEVO" }));

    await screen.findByRole("heading", { name: "Volviste" });
    expect(screen.getByText("Te vamos a seguir escribiendo con cada drop y restock.")).not.toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/newsletter/resubscribe?token=${TOKEN}`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByRole("button", { name: "ME ARREPENTÍ, ANOTARME DE NUEVO" })).toBeNull();
  });

  it("stays on the confirmation and announces an error when re-subscribing fails", async () => {
    stubFetch(204, 503);

    render(<UnsubscribeScreen token={TOKEN} />);
    fireEvent.click(await screen.findByRole("button", { name: "ME ARREPENTÍ, ANOTARME DE NUEVO" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No pudimos anotarte de nuevo. Probá de nuevo en un rato.",
    );
    expect(screen.getByRole("heading", { name: "Te diste de baja" })).not.toBeNull();
  });

  it("explains an unknown link (404) without suggesting a retry", async () => {
    stubFetch(404);

    render(<UnsubscribeScreen token={TOKEN} />);

    await screen.findByRole("heading", { name: "Este link no sirve" });
    expect(
      screen.getByText(
        "Puede que ya te hayas dado de baja o que el link esté incompleto. Si te siguen llegando emails, escribinos.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it.each([null, ""])("treats a missing token (%j) as an invalid link without any request", async (token) => {
    const fetchMock = stubFetch();

    render(<UnsubscribeScreen token={token} />);

    await screen.findByRole("heading", { name: "Este link no sirve" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[503], [new TypeError("offline")]])("offers a retry after a failure (%s) that POSTs again", async (failure) => {
    const fetchMock = stubFetch(failure, 204);

    render(<UnsubscribeScreen token={TOKEN} />);

    await screen.findByRole("heading", { name: "No pudimos darte de baja" });
    expect(screen.getByText("Probá de nuevo en un rato.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("heading", { name: "Te diste de baja" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("encodes the token so a hostile query value cannot add parameters", async () => {
    const fetchMock = stubFetch(404);

    render(<UnsubscribeScreen token="a&b=c" />);
    await screen.findByRole("heading", { name: "Este link no sirve" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/newsletter/unsubscribe?token=a%26b%3Dc",
      expect.anything(),
    );
  });
});
