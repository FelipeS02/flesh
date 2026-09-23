import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

vi.mock("../config", () => ({
  readAccessGateConfig: vi.fn(),
}));

import { cookies } from "next/headers";
import { readAccessGateConfig } from "../config";
import { isAccessGranted } from "../access-guard";
import { signToken } from "../../domain/session";

const SECRET = "test-secret";

describe("isAccessGranted", () => {
  it("grants access when the gate is disabled, without requiring a cookie", async () => {
    vi.mocked(readAccessGateConfig).mockReturnValue({ enabled: false });

    await expect(isAccessGranted()).resolves.toBe(true);
    expect(cookies).not.toHaveBeenCalled();
  });

  it("refuses when the gate is enabled and no cookie is present", async () => {
    vi.mocked(readAccessGateConfig).mockReturnValue({
      enabled: true,
      password: "hunter2",
      secret: SECRET,
      message: "SITIO EN **CONSTRUCCIÓN**",
    });
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(() => undefined) } as never);

    await expect(isAccessGranted()).resolves.toBe(false);
  });

  it("refuses a tampered or invalid cookie", async () => {
    vi.mocked(readAccessGateConfig).mockReturnValue({
      enabled: true,
      password: "hunter2",
      secret: SECRET,
      message: "SITIO EN **CONSTRUCCIÓN**",
    });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => ({ value: "not-a-real-token" })),
    } as never);

    await expect(isAccessGranted()).resolves.toBe(false);
  });

  it("grants access for a genuine, unexpired session cookie", async () => {
    vi.mocked(readAccessGateConfig).mockReturnValue({
      enabled: true,
      password: "hunter2",
      secret: SECRET,
      message: "SITIO EN **CONSTRUCCIÓN**",
    });
    const token = await signToken(Date.now() + 60_000, SECRET);
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => ({ value: token })),
    } as never);

    await expect(isAccessGranted()).resolves.toBe(true);
  });
});
