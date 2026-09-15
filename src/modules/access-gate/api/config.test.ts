import { describe, expect, it } from "vitest";
import { readAccessGateConfig } from "./config";

describe("readAccessGateConfig", () => {
  it("disables the gate when ACCESS_GATE_PASSWORD is unset", () => {
    expect(readAccessGateConfig({})).toEqual({ enabled: false });
  });

  it("disables the gate when ACCESS_GATE_PASSWORD is an empty string — a forgotten env var must never lock the store out", () => {
    expect(
      readAccessGateConfig({ ACCESS_GATE_PASSWORD: "", ACCESS_GATE_SECRET: "shh" }),
    ).toEqual({ enabled: false });
  });

  it("throws when a password is set but ACCESS_GATE_SECRET is missing", () => {
    expect(() => readAccessGateConfig({ ACCESS_GATE_PASSWORD: "hunter2" })).toThrow(
      /ACCESS_GATE_SECRET/,
    );
  });

  it("enables the gate with the default subtitle when no message is configured", () => {
    expect(
      readAccessGateConfig({ ACCESS_GATE_PASSWORD: "hunter2", ACCESS_GATE_SECRET: "shh" }),
    ).toEqual({
      enabled: true,
      password: "hunter2",
      secret: "shh",
      message: "SITIO EN **CONSTRUCCIÓN**",
    });
  });

  it("uses the configured message, trimmed, when one is set", () => {
    const parsed = readAccessGateConfig({
      ACCESS_GATE_PASSWORD: "hunter2",
      ACCESS_GATE_SECRET: "shh",
      ACCESS_GATE_MESSAGE: "  VOLVEMOS **PRONTO**  ",
    });

    expect(parsed.enabled).toBe(true);
    expect(parsed.enabled && parsed.message).toBe("VOLVEMOS **PRONTO**");
  });
});
