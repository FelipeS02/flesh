import { describe, expect, it, vi } from "vitest";
import { createCheckoutRateGuard } from "./checkout.guard";
import { resolveBuyer, startTiendanubeCheckout } from "./checkout.service";
import type { DraftOrderCheckoutResult } from "./checkout.tiendanube";

const VALID_BUYER = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" };
const OTHER_BUYER = { firstName: "Grace", lastName: "Hopper", email: "grace@example.com" };

const CATALOG = [{ productId: 101, variants: [
  { productId: 101, variantId: 201, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: 2 },
  { productId: 101, variantId: 202, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: null },
  { productId: 101, variantId: 203, price: { amount: 1000, currency: "ARS" }, stockManagement: false, stock: null },
] }];
const INPUT = { buyer: { firstName: " Ada ", lastName: " Lovelace ", email: "ada@example.com" }, lines: [{ productId: 101, variantId: 201, quantity: 2, price: { amount: 1, currency: "USD" } }] };
function dependencies() {
  const createDraftOrder = vi.fn(async (): Promise<DraftOrderCheckoutResult> => ({ status: "redirect", url: "https://checkout.example.com/checkout/99/token" }));
  const getCheckoutProducts = vi.fn(async () => CATALOG);
  const readBuyer = vi.fn(async (): Promise<unknown> => null);
  const writeBuyer = vi.fn(async () => {});
  return { dependencies: { getCheckoutProducts, createDraftOrder, guard: createCheckoutRateGuard(), readBuyer, writeBuyer }, createDraftOrder, getCheckoutProducts, readBuyer, writeBuyer };
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
    const outcome = await startTiendanubeCheckout(INPUT, { getCheckoutProducts: async () => CATALOG, createDraftOrder: async () => { throw new Error("secret upstream detail"); }, guard: createCheckoutRateGuard(), readBuyer: async () => null, writeBuyer: async () => {} });
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

describe("cookie write timing (spec amendment A2)", () => {
  it("writes the cookie for a valid submitted buyer even when the provider call then fails", async () => {
    const { dependencies: deps, writeBuyer, createDraftOrder } = dependencies();
    createDraftOrder.mockImplementation(async () => { throw new Error("provider down"); });

    await startTiendanubeCheckout(INPUT, deps);

    expect(writeBuyer).toHaveBeenCalledWith({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
  });

  it("writes the cookie for a valid submitted buyer when the provider redirects", async () => {
    const { dependencies: deps, writeBuyer } = dependencies();

    await startTiendanubeCheckout(INPUT, deps);

    expect(writeBuyer).toHaveBeenCalledWith({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
  });

  it("never writes when BuyerSchema fails on the submitted buyer, even with a valid stored cookie", async () => {
    const { dependencies: deps, writeBuyer, readBuyer } = dependencies();
    readBuyer.mockImplementation(async () => OTHER_BUYER);

    await startTiendanubeCheckout({ ...INPUT, buyer: { firstName: "" } }, deps);

    expect(writeBuyer).not.toHaveBeenCalled();
  });

  it("never writes when the rate guard refuses", async () => {
    const { dependencies: deps, writeBuyer } = dependencies();
    deps.guard = createCheckoutRateGuard({ limit: 0 });

    await startTiendanubeCheckout(INPUT, deps);

    expect(writeBuyer).not.toHaveBeenCalled();
  });

  it("never writes when resolution falls back to the stored cookie (source: cookie)", async () => {
    const { dependencies: deps, writeBuyer, readBuyer } = dependencies();
    readBuyer.mockImplementation(async () => OTHER_BUYER);

    await startTiendanubeCheckout({ ...INPUT, buyer: undefined }, deps);

    expect(writeBuyer).not.toHaveBeenCalled();
  });

  it("never writes when neither submitted nor stored resolves (source: none)", async () => {
    const { dependencies: deps, writeBuyer, createDraftOrder } = dependencies();

    const outcome = await startTiendanubeCheckout({ ...INPUT, buyer: undefined }, deps);

    expect(writeBuyer).not.toHaveBeenCalled();
    expect(createDraftOrder).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "unavailable", reason: "No pudimos iniciar el checkout. Intentá de nuevo." });
  });

  it("resolves the buyer from the stored cookie and reaches the provider when none was submitted", async () => {
    const { dependencies: deps, createDraftOrder, readBuyer } = dependencies();
    readBuyer.mockImplementation(async () => OTHER_BUYER);

    await startTiendanubeCheckout({ ...INPUT, buyer: undefined }, deps);

    expect(createDraftOrder).toHaveBeenCalledWith(expect.objectContaining({ buyer: OTHER_BUYER }));
  });
});

describe("resolveBuyer", () => {
  it("prefers a valid submitted buyer and rewrites the cookie, ignoring any stored value", () => {
    expect(resolveBuyer(VALID_BUYER, OTHER_BUYER)).toEqual({ source: "submitted", buyer: VALID_BUYER });
  });

  it("prefers a valid submitted buyer even when no cookie is stored", () => {
    expect(resolveBuyer(VALID_BUYER, undefined)).toEqual({ source: "submitted", buyer: VALID_BUYER });
  });

  it("falls back to a valid stored cookie when nothing was submitted", () => {
    expect(resolveBuyer(undefined, OTHER_BUYER)).toEqual({ source: "cookie", buyer: OTHER_BUYER });
  });

  it("falls back to a valid stored cookie when the submitted value is invalid", () => {
    expect(resolveBuyer({ firstName: "" }, OTHER_BUYER)).toEqual({ source: "cookie", buyer: OTHER_BUYER });
  });

  it("resolves to unavailable when both submitted and stored are absent", () => {
    expect(resolveBuyer(undefined, undefined)).toEqual({ source: "none" });
  });

  it("resolves to unavailable when both submitted and stored are invalid", () => {
    expect(resolveBuyer({ firstName: "" }, { firstName: "" })).toEqual({ source: "none" });
  });

  it("fails closed on a tampered cookie value — a hand-edited object never reaches the draft order call", () => {
    expect(resolveBuyer(undefined, { firstName: "Ada", lastName: "Lovelace" })).toEqual({ source: "none" });
  });

  it("fails closed on a partial cookie value missing required fields", () => {
    expect(resolveBuyer(undefined, { firstName: "Ada", lastName: "Lovelace", email: "not-an-email" })).toEqual({ source: "none" });
  });

  it("fails closed on a non-object cookie value", () => {
    expect(resolveBuyer(undefined, "just a string")).toEqual({ source: "none" });
    expect(resolveBuyer(undefined, null)).toEqual({ source: "none" });
    expect(resolveBuyer(undefined, 42)).toEqual({ source: "none" });
  });
});
