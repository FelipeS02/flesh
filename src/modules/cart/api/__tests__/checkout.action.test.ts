import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/access-gate/api/access-guard", () => ({
  isAccessGranted: vi.fn(),
}));

vi.mock("../checkout.service", () => ({
  startTiendanubeCheckout: vi.fn(async () => ({ status: "redirect", url: "https://checkout.example.com", draftOrderId: 1 })),
}));

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { startTiendanubeCheckout as startCheckoutService } from "../checkout.service";
import { startTiendanubeCheckout } from "../checkout.action";
import { CHECKOUT_FAILURE_REASON } from "../checkout-messages";

describe("startTiendanubeCheckout (action)", () => {
  it("refuses with the neutral unavailable outcome and never calls the service when the gate is not granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(false);

    await expect(startTiendanubeCheckout({})).resolves.toEqual({
      status: "unavailable",
      reason: CHECKOUT_FAILURE_REASON,
    });
    expect(startCheckoutService).not.toHaveBeenCalled();
  });

  it("delegates to the service when the gate is granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(true);

    await expect(startTiendanubeCheckout({ foo: "bar" })).resolves.toEqual({
      status: "redirect",
      url: "https://checkout.example.com",
      draftOrderId: 1,
    });
    expect(startCheckoutService).toHaveBeenCalledWith({ foo: "bar" });
  });
});
