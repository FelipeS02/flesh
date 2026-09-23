import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/access-gate/api/access-guard", () => ({
  isAccessGranted: vi.fn(),
}));

vi.mock("../pending-order.cookie", () => ({
  readPendingOrderCookie: vi.fn(async () => "order-1"),
  clearPendingOrderCookie: vi.fn(async () => {}),
}));

vi.mock("../order-status", () => ({
  hasCompletedOrder: vi.fn(async () => true),
}));

vi.mock("@/modules/catalog", () => ({
  readTiendanubeConfig: vi.fn(() => ({})),
}));

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { readPendingOrderCookie } from "../pending-order.cookie";
import { hasCompletedPendingCheckout } from "../order-status.action";

describe("hasCompletedPendingCheckout (action)", () => {
  it("returns false and never reads the pending order cookie when the gate is not granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(false);

    await expect(hasCompletedPendingCheckout()).resolves.toBe(false);
    expect(readPendingOrderCookie).not.toHaveBeenCalled();
  });

  it("delegates to the service when the gate is granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(true);

    await expect(hasCompletedPendingCheckout()).resolves.toBe(true);
    expect(readPendingOrderCookie).toHaveBeenCalled();
  });
});
