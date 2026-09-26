import { describe, expect, it, vi } from "vitest";
import { createCheckoutRateGuard } from "../checkout.guard";
import { resolveBuyer, startTiendanubeCheckout } from "../checkout.service";
import type { DraftOrderCheckoutResult } from "../checkout.tiendanube";

const VALID_BUYER = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" };
const OTHER_BUYER = { firstName: "Grace", lastName: "Hopper", email: "grace@example.com" };

const CATALOG = [{ productId: 101, variants: [
  { productId: 101, variantId: 201, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: 2 },
  { productId: 101, variantId: 202, price: { amount: 1000, currency: "ARS" }, stockManagement: true, stock: null },
  { productId: 101, variantId: 203, price: { amount: 1000, currency: "ARS" }, stockManagement: false, stock: null },
] }];
const INPUT = { buyer: { firstName: " Ada ", lastName: " Lovelace ", email: "ada@example.com" }, lines: [{ productId: 101, variantId: 201, quantity: 2, price: { amount: 1, currency: "USD" } }] };
function dependencies() {
  const createDraftOrder = vi.fn(async (): Promise<DraftOrderCheckoutResult> => ({ status: "redirect", url: "https://checkout.example.com/checkout/99/token", draftOrderId: 2070706008 }));
  const getCheckoutProducts = vi.fn(async () => CATALOG);
  const readBuyer = vi.fn(async (): Promise<unknown> => null);
  const writeBuyer = vi.fn(async () => {});
  const writePendingOrder = vi.fn(async () => {});
  const reportCheckoutStarted = vi.fn(async () => {});
  const readClientKey = vi.fn(async () => "client-a");
  const isBot = vi.fn(async () => false);
  return {
    dependencies: { getCheckoutProducts, createDraftOrder, clientGuard: createCheckoutRateGuard(), globalGuard: createCheckoutRateGuard(), readClientKey, isBot, readBuyer, writeBuyer, writePendingOrder, reportCheckoutStarted },
    createDraftOrder,
    getCheckoutProducts,
    readBuyer,
    writeBuyer,
    writePendingOrder,
    reportCheckoutStarted,
    readClientKey,
    isBot,
  };
}

describe("startTiendanubeCheckout", () => {
  it("reconstructs trusted identity and ignores client price", async () => {
    const { dependencies: deps, createDraftOrder } = dependencies();
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toEqual({ status: "redirect", url: "https://checkout.example.com/checkout/99/token", draftOrderId: 2070706008 });
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

  it("denies after the client limit without catalog or provider I/O", async () => {
    const { dependencies: deps, getCheckoutProducts, createDraftOrder } = dependencies();
    deps.clientGuard = createCheckoutRateGuard({ limit: 0 });
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "unavailable" });
    expect(getCheckoutProducts).not.toHaveBeenCalled();
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it("converts an upstream failure into a generic unavailable outcome", async () => {
    const outcome = await startTiendanubeCheckout(INPUT, { getCheckoutProducts: async () => CATALOG, createDraftOrder: async () => { throw new Error("secret upstream detail"); }, clientGuard: createCheckoutRateGuard(), globalGuard: createCheckoutRateGuard(), readClientKey: async () => "client-a", isBot: async () => false, readBuyer: async () => null, writeBuyer: async () => {}, writePendingOrder: async () => {}, reportCheckoutStarted: async () => {} });
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

describe("per-client limit and global breaker (T3)", () => {
  it("still reaches the provider for a different client after one client is exhausted", async () => {
    const { dependencies: deps, createDraftOrder, readClientKey } = dependencies();
    deps.clientGuard = createCheckoutRateGuard({ limit: 1 });
    readClientKey.mockResolvedValueOnce("client-a").mockResolvedValueOnce("client-a").mockResolvedValueOnce("client-b");

    await startTiendanubeCheckout(INPUT, deps); // client-a spends its one slot
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "unavailable" }); // client-a refused
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "redirect" }); // client-b unaffected
    expect(createDraftOrder).toHaveBeenCalledTimes(2);
  });

  it("refuses through the global breaker once exhausted, even for a fresh client", async () => {
    const { dependencies: deps, createDraftOrder, readClientKey } = dependencies();
    deps.globalGuard = createCheckoutRateGuard({ limit: 0 });
    readClientKey.mockResolvedValue("client-fresh");

    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "unavailable" });
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it("refuses a bot before the global breaker, the catalog, the provider or the buyer cookie", async () => {
    const { dependencies: deps, isBot, getCheckoutProducts, createDraftOrder, writeBuyer } = dependencies();
    isBot.mockResolvedValue(true);
    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({ status: "unavailable" });
    expect(deps.globalGuard.size()).toBe(0);
    expect(getCheckoutProducts).not.toHaveBeenCalled();
    expect(createDraftOrder).not.toHaveBeenCalled();
    expect(writeBuyer).not.toHaveBeenCalled();
  });

  it("does not ask for a bot verdict once the client guard has already refused", async () => {
    const { dependencies: deps, isBot } = dependencies();
    deps.clientGuard = createCheckoutRateGuard({ limit: 0 });
    await startTiendanubeCheckout(INPUT, deps);
    expect(isBot).not.toHaveBeenCalled();
  });

  it("does not ask for a bot verdict on malformed input", async () => {
    const { dependencies: deps, isBot } = dependencies();
    await startTiendanubeCheckout({ ...INPUT, lines: [] }, deps);
    expect(isBot).not.toHaveBeenCalled();
  });

  it("does not spend the global budget on a no-identity submission", async () => {
    const { dependencies: deps } = dependencies();

    const outcome = await startTiendanubeCheckout({ ...INPUT, buyer: undefined }, deps);

    expect(outcome).toMatchObject({ status: "unavailable", reason: expect.any(String) });
    // A submission with source "none" returns before the global breaker is
    // ever consumed, so the full budget remains for a later real submission.
    expect(deps.globalGuard.size()).toBe(0);
  });

  it("consumes neither guard for malformed input", async () => {
    const { dependencies: deps } = dependencies();

    await startTiendanubeCheckout({ ...INPUT, lines: [] }, deps);

    expect(deps.clientGuard.size()).toBe(0);
    expect(deps.globalGuard.size()).toBe(0);
  });
});

describe("cookie write timing (spec amendment A2)", () => {
  it("writes the cookie for a valid submitted buyer even when the provider call then fails", async () => {
    const { dependencies: deps, writeBuyer, createDraftOrder } = dependencies();
    createDraftOrder.mockImplementation(async () => { throw new Error("provider down"); });

    await startTiendanubeCheckout(INPUT, deps);

    expect(writeBuyer).toHaveBeenCalledWith({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
  });

  // The whole post-checkout cart reconciliation hangs off this id being
  // recorded: without it the shopper returns to a cart holding what they just
  // bought, and nothing else in the suite notices the call going missing.
  it("records the draft order id so the cart can later learn it was bought", async () => {
    const { dependencies: deps, writePendingOrder } = dependencies();

    await startTiendanubeCheckout(INPUT, deps);

    expect(writePendingOrder).toHaveBeenCalledWith(2070706008);
    expect(writePendingOrder).toHaveBeenCalledOnce();
  });

  // Nothing was handed off, so there is no pending order to ask about. Recording
  // one would leave a stale id that resolves to "not purchased" for a day.
  it("records nothing when the provider refuses the cart", async () => {
    const { dependencies: deps, createDraftOrder, writePendingOrder } = dependencies();
    createDraftOrder.mockResolvedValueOnce({ status: "rejected", variantIds: [201] });

    await startTiendanubeCheckout(INPUT, deps);

    expect(writePendingOrder).not.toHaveBeenCalled();
  });

  /**
   * Meta is told with the trusted price, not the one the client sent — the
   * same reconstruction the draft order gets. A cart reported at the client's
   * figure would teach the ad algorithm to bid against numbers a shopper can
   * edit.
   */
  it("reports the handoff to Meta with the reconstructed cart", async () => {
    const { dependencies: deps, reportCheckoutStarted } = dependencies();

    await startTiendanubeCheckout(INPUT, deps);

    expect(reportCheckoutStarted).toHaveBeenCalledWith({
      buyer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      lines: [
        { variantId: 201, quantity: 2, price: { amount: 1000, currency: "ARS" } },
      ],
    });
  });

  // No handoff happened, so there was no checkout to initiate.
  it("reports nothing to Meta when the provider refuses the cart", async () => {
    const { dependencies: deps, createDraftOrder, reportCheckoutStarted } = dependencies();
    createDraftOrder.mockResolvedValueOnce({ status: "rejected", variantIds: [201] });

    await startTiendanubeCheckout(INPUT, deps);

    expect(reportCheckoutStarted).not.toHaveBeenCalled();
  });

  // The measurement is the expendable half of this pair, always.
  it("still completes the checkout when the Meta report fails", async () => {
    const { dependencies: deps, reportCheckoutStarted } = dependencies();
    reportCheckoutStarted.mockRejectedValueOnce(new Error("meta unreachable"));

    await expect(startTiendanubeCheckout(INPUT, deps)).resolves.toMatchObject({
      status: "redirect",
      draftOrderId: 2070706008,
    });
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

  it("never writes when the client rate guard refuses", async () => {
    const { dependencies: deps, writeBuyer } = dependencies();
    deps.clientGuard = createCheckoutRateGuard({ limit: 0 });

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

// The shopper must keep seeing one generic outcome; the operator must not. The
// silence these cover is what made a real checkout outage undiagnosable: eight
// causes, one identical response, and nothing written down anywhere.
describe("server-side diagnostics", () => {
  function captureLog() {
    return vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it("records why it gave up without changing what the shopper is told", async () => {
    const consoleError = captureLog();
    const { dependencies: deps, createDraftOrder } = dependencies();
    createDraftOrder.mockImplementation(async () => { throw new Error("secret upstream detail"); });

    const outcome = await startTiendanubeCheckout(INPUT, deps);

    expect(outcome).toEqual({ status: "unavailable", reason: "No pudimos iniciar el checkout. Intentá de nuevo." });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleError.mock.calls[0])).not.toContain("secret upstream detail");
    consoleError.mockRestore();
  });

  it.each([
    [{ ...INPUT, padding: "x".repeat(9_000) }, "oversized_request"],
    [{ ...INPUT, lines: [] }, "invalid_input"],
  ])("names an input-shaped refusal that never reaches the provider", async (input, reason) => {
    const consoleError = captureLog();
    const { dependencies: deps } = dependencies();

    await startTiendanubeCheckout(input, deps);

    expect(consoleError).toHaveBeenCalledWith("[checkout] unavailable", { reason });
    consoleError.mockRestore();
  });

  it("names a refusal caused by the client rate guard", async () => {
    const consoleError = captureLog();
    const { dependencies: deps } = dependencies();
    deps.clientGuard = createCheckoutRateGuard({ limit: 0 });

    await startTiendanubeCheckout(INPUT, deps);

    expect(consoleError).toHaveBeenCalledWith("[checkout] unavailable", { reason: "rate_limited" });
    consoleError.mockRestore();
  });

  it("names a refusal caused by the global breaker", async () => {
    const consoleError = captureLog();
    const { dependencies: deps } = dependencies();
    deps.globalGuard = createCheckoutRateGuard({ limit: 0 });

    await startTiendanubeCheckout(INPUT, deps);

    expect(consoleError).toHaveBeenCalledWith("[checkout] unavailable", { reason: "rate_limited" });
    consoleError.mockRestore();
  });

  it("names a refusal caused by the bot check", async () => {
    const consoleError = captureLog();
    const { dependencies: deps, isBot } = dependencies();
    isBot.mockResolvedValue(true);

    await startTiendanubeCheckout(INPUT, deps);

    expect(consoleError).toHaveBeenCalledWith("[checkout] unavailable", { reason: "bot_detected" });
    consoleError.mockRestore();
  });

  it("names a submission with no usable buyer identity", async () => {
    const consoleError = captureLog();
    const { dependencies: deps } = dependencies();

    await startTiendanubeCheckout({ ...INPUT, buyer: undefined }, deps);

    expect(consoleError).toHaveBeenCalledWith("[checkout] unavailable", { reason: "no_buyer_identity" });
    consoleError.mockRestore();
  });

  it("stays quiet when the provider refuses named variants, which is an answer and not a fault", async () => {
    const consoleError = captureLog();
    const { dependencies: deps, createDraftOrder } = dependencies();
    createDraftOrder.mockResolvedValue({ status: "rejected", variantIds: [201] });

    await startTiendanubeCheckout(INPUT, deps);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("stays quiet on a successful handoff", async () => {
    const consoleError = captureLog();
    const { dependencies: deps } = dependencies();

    await startTiendanubeCheckout(INPUT, deps);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
