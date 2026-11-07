import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { RestockOutcome } from "../../api/newsletter.service";
import type { RestockPort } from "../newsletter.client";
import { RESTOCK_PITCH, RestockForm } from "../restock-form";

const LINE = "NEGRO · M";

function port(outcome: RestockOutcome = { ok: true, status: "created" }) {
  return { request: vi.fn<RestockPort["request"]>().mockResolvedValue(outcome) } satisfies RestockPort;
}

function renderForm(
  restockPort: RestockPort = port(),
  props: Partial<Parameters<typeof RestockForm>[0]> = {},
) {
  return render(
    <RestockForm productId={7} variantId={42} variantLine={LINE} port={restockPort} {...props} />,
  );
}

async function submit(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
  });
}

describe("RestockForm (panel)", () => {
  it("says what it is for", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Avisame cuando vuelva" })).toBeDefined();
    expect(screen.getByText(RESTOCK_PITCH)).toBeDefined();
  });

  // The size already reads on the selector right above; repeated here it was
  // a lone, tiny "M" under a 34px heading.
  it("does not repeat the variant line while idle", () => {
    renderForm();

    expect(screen.queryByText(LINE)).toBeNull();
  });

  it("asks for an email in a typed, labelled field", () => {
    renderForm();

    const input = screen.getByLabelText(/email/i) as HTMLInputElement;

    expect(input.type).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.placeholder).toBe("tu@email.com");
  });

  // Consent has to be an act: pre-ticked would make the newsletter opt-out.
  it("leaves the newsletter box unchecked by default", () => {
    renderForm();

    expect(
      screen
        .getByRole("checkbox", { name: "Quiero recibir novedades y lanzamientos de FLESH." })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("sends product, variant, email and an unchecked newsletter flag", async () => {
    const restockPort = port();
    renderForm(restockPort);

    await submit("fan@flesh.test");

    expect(restockPort.request).toHaveBeenCalledWith({
      email: "fan@flesh.test",
      productId: 7,
      variantId: 42,
      newsletter: false,
    });
  });

  it("sends newsletter true once the box is ticked", async () => {
    const restockPort = port();
    renderForm(restockPort);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Quiero recibir novedades y lanzamientos de FLESH." }),
    );
    await submit("fan@flesh.test");

    expect(restockPort.request).toHaveBeenCalledWith(expect.objectContaining({ newsletter: true }));
  });

  it("disables the button and says so while the request is in flight", async () => {
    let resolve!: (value: RestockOutcome) => void;
    const pending = new Promise<RestockOutcome>((done) => (resolve = done));
    renderForm({ request: vi.fn(() => pending) });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect((screen.getByRole("button", { name: "Enviando…" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => resolve({ ok: true, status: "created" }));
  });

  it("confirms a new request and names the variant and the address", async () => {
    renderForm();

    await submit("fan@flesh.test");

    expect(screen.getByRole("heading", { name: "Te avisamos" })).toBeDefined();
    expect(
      screen.getByText(`Cuando entre ${LINE} te escribimos a fan@flesh.test.`),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Avisame" })).toBeNull();
  });

  it("says so when the address was already waiting for this variant", async () => {
    renderForm(port({ ok: true, status: "already-requested" }));

    await submit("fan@flesh.test");

    expect(screen.getByRole("heading", { name: "Ya estás anotado" })).toBeDefined();
    expect(
      screen.getByText(`fan@flesh.test ya espera ${LINE}. Te escribimos apenas entre.`),
    ).toBeDefined();
  });

  it("goes back to an empty form from 'USAR OTRO EMAIL'", async () => {
    renderForm();

    await submit("fan@flesh.test");
    fireEvent.click(screen.getByRole("button", { name: "USAR OTRO EMAIL" }));

    expect(screen.getByRole("heading", { name: "Avisame cuando vuelva" })).toBeDefined();
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe("");
  });

  it("flags an invalid email on the field and in an alert", async () => {
    renderForm(port({ ok: false, error: "invalid-email" }));

    await submit("nope");

    expect(screen.getByRole("alert").textContent).toContain("Revisá el email, le falta algo.");
    expect(screen.getByLabelText(/email/i).getAttribute("aria-invalid")).toBe("true");
  });

  it("offers a retry when the service is unavailable, keeping what was typed", async () => {
    renderForm(port({ ok: false, error: "unavailable" }));

    await submit("fan@flesh.test");

    expect(screen.getByRole("alert").textContent).toContain("No pudimos anotarte. Probá de nuevo.");
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe("fan@flesh.test");
    expect((screen.getByRole("button", { name: "Avisame" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("clears the error once a retry works", async () => {
    const request = vi
      .fn<RestockPort["request"]>()
      .mockResolvedValueOnce({ ok: false, error: "unavailable" })
      .mockResolvedValueOnce({ ok: true, status: "created" });
    renderForm({ request });

    await submit("fan@flesh.test");
    await submit("fan@flesh.test");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { name: "Te avisamos" })).toBeDefined();
  });
});

describe("RestockForm (sheet)", () => {
  function renderSheet(restockPort: RestockPort = port()) {
    return renderForm(restockPort, { layout: "sheet" });
  }

  // The sheet's own header already carries the title and the pitch.
  it("leaves the heading and the pitch to the sheet while idle", () => {
    renderSheet();

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByText(RESTOCK_PITCH)).toBeNull();
    expect(screen.getByLabelText("EMAIL")).toBeDefined();
  });

  it("submits through the same port with the same payload", async () => {
    const restockPort = port();
    renderSheet(restockPort);

    fireEvent.change(screen.getByLabelText("EMAIL"), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect(restockPort.request).toHaveBeenCalledWith({
      email: "fan@flesh.test",
      productId: 7,
      variantId: 42,
      newsletter: false,
    });
  });

  it("shows the confirmation heading itself once the request lands", async () => {
    renderSheet();

    fireEvent.change(screen.getByLabelText("EMAIL"), { target: { value: "fan@flesh.test" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Avisame" }));
    });

    expect(screen.getByRole("heading", { name: "Te avisamos" })).toBeDefined();
  });
});
