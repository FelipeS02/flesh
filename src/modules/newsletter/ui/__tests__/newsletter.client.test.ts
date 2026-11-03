import { describe, expect, it, vi } from "vitest";
import { createSubscribePort } from "../newsletter.client";

describe("createSubscribePort", () => {
  it("sends the address and hands back the action's outcome untouched", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });

    const outcome = await createSubscribePort(action).subscribe("a@b.co");

    expect(action).toHaveBeenCalledWith({ email: "a@b.co" });
    expect(outcome).toEqual({ ok: true });
  });

  it("passes a typed refusal through", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "invalid-email" });

    expect(await createSubscribePort(action).subscribe("nope")).toEqual({
      ok: false,
      error: "invalid-email",
    });
  });

  // A Server Action call is a network request: it rejects when the user is
  // offline or the deploy changed under an open tab. The form can only show
  // "try again", so a rejection must arrive as that outcome, not as an
  // unhandled rejection that leaves the button stuck on "Enviando…".
  it("turns a rejected request into the unavailable outcome", async () => {
    const action = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await createSubscribePort(action).subscribe("a@b.co")).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});
