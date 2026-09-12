import { describe, expect, it, vi } from "vitest";
import { createCheckoutRateGuard } from "./checkout.guard";
import { startTiendanubeCheckout } from "./checkout.service";
import type { DraftOrderCheckoutResult } from "./checkout.tiendanube";

const CATALOG = [{ productId: 101, variants: [
  { productId: 101, variantId: 201, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: 2 },
  { productId: 101, variantId: 202, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: null },
  { productId: 101, variantId: 203, price: { amount: 1000, currency: "ARS" }, stockManagement: false, stock: null },
] }];
const INPUT = { buyer: { firstName: " Ada ", lastName: " Lovelace ", email: "ada@example.com" }, lines: [{ productId: 101, variantId: 201, quantity: 2, price: { amount: 1, currency: "USD" } }] };
function dependencies() {
  const createDraftOrder = vi.fn(async (): Promise<DraftOrderCheckoutResult> => ({ status: "redirect", url: "https://checkout.example.com/checkout/99/token" }));
  const getCheckoutProducts = vi.fn(async () => CATALOG);
  return { dependencies: { getCheckoutProducts, createDraftOrder, guard: createCheckoutRateGuard() }, createDraftOrder, getCheckoutProducts };
}

describe("startTiendanubeCheckout", () => {
  it("reconstructs trusted identity and ignores client price", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toEqual({ status: "redirect", url: "https://checkout.example.com/checkout/99/token" });
    expect(createDraftOrder).toHaveBeenCalledWith({ buyer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }, products: [{ variantId: 201, quantity: 2 }] });
  });

  it.each([
    [{ ...INPUT, lines: [{ ...INPUT.lines[0], productId: 999 }] }, [201]],
    [{ ...INPUT, lines: [{ ...INPUT.lines[0], variantId: 999 }] }, [999]],
    [{ ...INPUT, lines: [{ ...INPUT.lines[0], quantity: 3 }] }, [201]],
    [{ ...INPUT, lines: [{ ...INPUT.lines[0], variantId: 202 }] }, [202]],
  ])("rejects forged or unavailable current catalog lines", async (input, lines) => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    await expect(startTiendanubeCheckout(input, deps)).resolves.toEqual({ status: "rejected", lines });
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it("permits an unmanaged variant within the bounded quantity", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    await startTiendanubeCheckout({ ...INPUT, lines: [{ productId: 101, variantId: 203, quantity: 10 }] }, deps);
    expect(createDraftOrder).toHaveBeenCalledWith(expect.objectContaining({ products: [{ variantId: 203, quantity: 10 }] }));
  });

  it.each([
    { ...INPUT, buyer: { ...INPUT.buyer, firstName: "x".repeat(81) } },
    { ...INPUT, lines: Array.from({ length: 13 }, (_, index) => ({ productId: 101, variantId: 300 + index, quantity: 1 })) },
    { ...INPUT, lines: [{ productId: 101, variantId: 201, quantity: 11 }] },
    { ...INPUT, lines: [{ productId: 101, variantId: 201, quantity: 1 }, { productId: 101, variantId: 201, quantity: 1 }] },
    { ...INPUT, padding: "x".repeat(9_000) },
  ])("rejects malformed input before consuming a guard slot or catalog I/O", async (input) => {
    const { dependencies: deps, createDraftOrder, getCheckoutProducts } = dependencies();
    const outcome = await startTiendanubeCheckout(input, deps);
    expect(outcome).toMatchObject({ status: "unavailable" });
    expect(getCheckoutProducts).not.toHaveBeenCalled();
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it("denies after the limit without catalog or provider I/O", async () => {
    const { dependencies: deps, getCheckoutProducts, createDraftOrder } = dependencies();
    deps.guard = createCheckoutRateGuard({ limit: 0 });
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "unavailable" });
    expect(getCheckoutProducts).not.toHaveBeenCalled();
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it("converts an upstream failure into a generic unavailable outcome", async () => {
    const outcome = await startTiendanubeCheckout(INPUT, { getCheckoutProducts: async () => CATALOG, createDraftOrder: async () => { throw new Error("secret upstream detail"); }, guard: createCheckoutRateGuard() });
    expect(outcome).toEqual({ status: "unavailable", reason: "No pudimos iniciar el checkout. Intentá de nuevo." });
  });

  it("surfaces the variants the provider refused, even though the cached catalog allowed them", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    createDraftOrder.mockResolvedValue({ status: "rejected", variantIds: [201] });

    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toEqual({ status: "rejected", lines: [201] });
  });

  it("keeps only refused variants the buyer actually asked for", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    createDraftOrder.mockResolvedValue({ status: "rejected", variantIds: [201, 999] });

    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toEqual({ status: "rejected", lines: [201] });
  });

  it("falls back to the generic failure when the provider refuses only variants that were never requested", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    createDraftOrder.mockResolvedValue({ status: "rejected", variantIds: [999] });

    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toEqual({ status: "unavailable", reason: "No pudimos iniciar el checkout. Intentá de nuevo." });
  });
});
