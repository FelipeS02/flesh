import { describe, expect, it } from "vitest";
import { createTiendanubeCheckout } from "../checkout.client";

const REQUEST = {
  buyer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  lines: [{ productId: 101, variantId: 201, quantity: 1, price: { amount: 1000, currency: "ARS" } }],
};

describe("createTiendanubeCheckout", () => {
  it("passes a validated HTTPS redirect through", async () => {
    const port = createTiendanubeCheckout(async () => ({
      status: "redirect", url: "https://checkout.example.com/checkout/99/token", draftOrderId: 2070706008,
    }));

    await expect(port.startCheckout(REQUEST)).resolves.toEqual({
      status: "redirect", url: "https://checkout.example.com/checkout/99/token", draftOrderId: 2070706008,
    });
  });

  it.each(["http://checkout.example.com", "not a URL"])('refuses unsafe redirect URL "%s"', async (url) => {
    const port = createTiendanubeCheckout(async () => ({ status: "redirect", url, draftOrderId: 1 }));

    await expect(port.startCheckout(REQUEST)).resolves.toMatchObject({ status: "unavailable" });
  });
});
