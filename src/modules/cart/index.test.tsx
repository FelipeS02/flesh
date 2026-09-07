import { describe, expect, it } from "vitest";
import type { CheckoutPort } from "./index";
import { CartDrawer, CartProvider, useCartDispatch, useCartEnvironment, useCartState } from "./index";

describe("cart public entry", () => {
  it("is the single public entry for the provider, hooks, UI, and checkout port type", () => {
    const port: CheckoutPort = { startCheckout: async () => ({ status: "unavailable", reason: "test" }) };

    expect(CartProvider).toBeTypeOf("function");
    expect(useCartState).toBeTypeOf("function");
    expect(useCartDispatch).toBeTypeOf("function");
    expect(useCartEnvironment).toBeTypeOf("function");
    expect(CartDrawer).toBeTypeOf("function");
    expect(port.startCheckout).toBeTypeOf("function");
  });
});