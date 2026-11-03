import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/access-gate/api/access-guard", () => ({ isAccessGranted: vi.fn() }));
vi.mock("../newsletter.service", () => ({
  subscribeToNewsletter: vi.fn(async () => ({ ok: true })),
  requestRestockNotice: vi.fn(async () => ({ ok: true, status: "created" })),
}));

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { requestRestockNotice as restockService, subscribeToNewsletter as subscribeService } from "../newsletter.service";
import { subscribeToNewsletter } from "../subscribe.action";
import { requestRestockNotice } from "../restock.action";

describe("newsletter actions", () => {
  it("refuse with the generic unavailable result and never reach a service when the gate is closed", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(false);

    await expect(subscribeToNewsletter({ email: "a@b.com" })).resolves.toEqual({ ok: false, error: "unavailable" });
    await expect(requestRestockNotice({})).resolves.toEqual({ ok: false, error: "unavailable" });
    expect(subscribeService).not.toHaveBeenCalled();
    expect(restockService).not.toHaveBeenCalled();
  });

  it("delegate the untouched input to the services once the gate is granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(true);

    await expect(subscribeToNewsletter({ email: "a@b.com" })).resolves.toEqual({ ok: true });
    await expect(requestRestockNotice({ x: 1 })).resolves.toEqual({ ok: true, status: "created" });
    expect(subscribeService).toHaveBeenCalledWith({ email: "a@b.com" });
    expect(restockService).toHaveBeenCalledWith({ x: 1 });
  });
});
