import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GateForm } from "./gate-form";

describe("GateForm", () => {
  it("has an accessible name on the password field even though it renders no visible label", () => {
    render(<GateForm unlock={vi.fn()} onUnlocked={vi.fn()} />);

    // A placeholder alone is never an accessible name — `getByLabelText`
    // only finds the field because of the explicit `aria-label`.
    const input = screen.getByLabelText("Contraseña");
    expect(input.tagName).toBe("INPUT");
  });

  it("marks the field invalid and announces the error on a rejected password", async () => {
    const unlock = vi.fn().mockResolvedValue({ ok: false, error: "invalid-password" });
    render(<GateForm unlock={unlock} onUnlocked={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Contraseña incorrecta. Probá de nuevo.");

    const input = screen.getByLabelText("Contraseña");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("calls onUnlocked on a matching password and never renders the error", async () => {
    const unlock = vi.fn().mockResolvedValue({ ok: true });
    const onUnlocked = vi.fn();
    render(<GateForm unlock={unlock} onUnlocked={onUnlocked} />);

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(unlock).toHaveBeenCalledWith("hunter2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables the button and swaps its label while pending, not by colour alone", async () => {
    let resolveUnlock!: (result: { ok: true }) => void;
    const unlock = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveUnlock = resolve;
        }),
    );
    render(<GateForm unlock={unlock} onUnlocked={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const button = await screen.findByRole("button", { name: "Entrando…" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    resolveUnlock({ ok: true });
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Entrar"));
  });

  it("disables the input and the button and announces the wait when the guard blocks the client", async () => {
    const unlock = vi.fn().mockResolvedValue({ ok: false, error: "too-many-attempts", retryAfterMs: 5 * 60_000 });
    render(<GateForm unlock={unlock} onUnlocked={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Demasiados intentos. Probá de nuevo en 5 minutos.");

    const input = screen.getByLabelText("Contraseña");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(input.hasAttribute("disabled")).toBe(true);

    // The label itself stays "Entrar" while blocked — only the pending
    // state says "Entrando…" — so the button is found by disabled state.
    const button = screen.getByRole("button", { name: "Entrar" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("rounds a sub-minute retry window up to one minute instead of showing zero", async () => {
    const unlock = vi.fn().mockResolvedValue({ ok: false, error: "too-many-attempts", retryAfterMs: 1_500 });
    render(<GateForm unlock={unlock} onUnlocked={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Demasiados intentos. Probá de nuevo en 1 minuto.");
  });
});
