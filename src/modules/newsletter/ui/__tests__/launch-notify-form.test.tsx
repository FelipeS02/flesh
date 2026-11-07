import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { LaunchOutcome } from "../../api/newsletter.service";
import type { LaunchPort } from "../newsletter.client";
import { LaunchNotifyForm } from "../launch-notify-form";

function port(outcome: LaunchOutcome = { ok: true, status: "created" }) {
  return { request: vi.fn<LaunchPort["request"]>().mockResolvedValue(outcome) } satisfies LaunchPort;
}

async function submit(email: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" }), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
  });
}

describe("LaunchNotifyForm", () => {
  // jsdom lays nothing out, so the layout contract is read off the class list.
  // The form is stacked on every viewport: a growing field would collapse to
  // its content height in a column (flex-basis 0 took it from 54px to 26px).
  it("stacks the field above the button and never lets the field flex-grow", () => {
    render(<LaunchNotifyForm productId={7} port={port()} />);

    const input = screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" });
    const classes = input.className.split(" ");

    expect(classes).not.toContain("flex-1");
    expect(classes).not.toContain("md:flex-1");
    expect(input.parentElement?.className).not.toContain("flex-row");
  });

  it("shows its label, which is also the field's accessible name", () => {
    render(<LaunchNotifyForm productId={7} port={port()} />);

    const label = screen.getByText("RECIBÍ NOVEDADES:");

    expect(label.className).not.toContain("sr-only");
    expect(screen.getByLabelText("RECIBÍ NOVEDADES:")).toBe(
      screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" }),
    );
  });

  it("asks for an email in a typed, labelled field", () => {
    render(<LaunchNotifyForm productId={7} port={port()} />);

    const input = screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" }) as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.placeholder).toBe("tu@email.com");
    expect(screen.queryByText(/te escribimos una sola vez/i)).toBeNull();
  });

  // The shopper asked for one email, so the form must not smuggle in a
  // newsletter opt-in.
  it("offers no newsletter consent box", () => {
    render(<LaunchNotifyForm productId={7} port={port()} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("sends only the email and the product", async () => {
    const launchPort = port();
    render(<LaunchNotifyForm productId={7} port={launchPort} />);

    await submit("fan@flesh.test");

    expect(launchPort.request).toHaveBeenCalledWith({ email: "fan@flesh.test", productId: 7 });
  });

  it("replaces the form with a polite confirmation once stored", async () => {
    render(<LaunchNotifyForm productId={7} port={port()} />);

    await submit("fan@flesh.test");

    expect(screen.getByRole("status").textContent).toContain("Listo. Te escribimos el día que salga.");
    expect(screen.queryByRole("button", { name: "Avisame" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "RECIBÍ NOVEDADES:" })).toBeNull();
  });

  it("confirms the same way when the address was already waiting", async () => {
    render(<LaunchNotifyForm productId={7} port={port({ ok: true, status: "already-requested" })} />);

    await submit("fan@flesh.test");

    expect(screen.getByRole("status").textContent).toContain("Listo. Te escribimos el día que salga.");
  });

  it("flags an invalid email on the field and in an alert", async () => {
    render(<LaunchNotifyForm productId={7} port={port({ ok: false, error: "invalid-email" })} />);

    await submit("nope");

    expect(screen.getByRole("alert").textContent).toContain("Revisá el email, le falta algo.");
    expect(screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" }).getAttribute("aria-invalid")).toBe("true");
  });

  it("offers a retry when unavailable, keeping what was typed", async () => {
    render(<LaunchNotifyForm productId={7} port={port({ ok: false, error: "unavailable" })} />);

    await submit("fan@flesh.test");

    expect(screen.getByRole("alert").textContent).toContain("No pudimos anotarte. Probá de nuevo.");
    expect((screen.getByRole("textbox", { name: "RECIBÍ NOVEDADES:" }) as HTMLInputElement).value).toBe("fan@flesh.test");
    expect((screen.getByRole("button", { name: "Avisame" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the button while the request is in flight, keeping its label", async () => {
    let resolve!: (value: LaunchOutcome) => void;
    const pending = new Promise<LaunchOutcome>((done) => (resolve = done));
    render(<LaunchNotifyForm productId={7} port={{ request: vi.fn(() => pending) }} />);

    await submit("a@b.co");

    expect((screen.getByRole("button", { name: "Avisame" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => resolve({ ok: true, status: "created" }));
  });
});
