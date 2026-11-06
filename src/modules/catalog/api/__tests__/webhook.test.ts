import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleCatalogWebhook, readCatalogWebhookSecret } from "../webhook";

const SECRET = "app-client-secret";
const STORE_ID = "8176730";
const BODY = JSON.stringify({ store_id: 8176730, event: "product/updated", id: 366252433 });

const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

function webhookRequest(body: string, signature: string | null) {
  return new Request("https://flesh.test/api/webhooks/tiendanube", {
    method: "POST",
    body,
    ...(signature === null ? {} : { headers: { "x-linkedstore-hmac-sha256": signature } }),
  });
}

function dependencies() {
  const revalidate = vi.fn();
  return { dependencies: { secret: SECRET, storeId: STORE_ID, revalidate }, revalidate };
}

describe("handleCatalogWebhook", () => {
  it("marks the catalog snapshot stale for an authentic delivery", async () => {
    const { dependencies: deps, revalidate } = dependencies();

    const response = await handleCatalogWebhook(webhookRequest(BODY, sign(BODY)), deps);

    expect(response.status).toBe(204);
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith("tiendanube-catalog");
  });

  it.each([
    ["a body altered after signing", JSON.stringify({ store_id: 8176730, event: "product/updated", id: 1 }), sign(BODY)],
    ["a signature from a different secret", BODY, sign(BODY, "not-the-secret")],
    ["a well-formed but wrong digest", BODY, "0".repeat(64)],
    ["a digest of the wrong length", BODY, "abc123"],
    ["a non-hexadecimal header", BODY, "z".repeat(64)],
    ["an empty header", BODY, ""],
  ])("rejects %s without revalidating", async (label, body, signature) => {
    void label;
    const { dependencies: deps, revalidate } = dependencies();

    const response = await handleCatalogWebhook(webhookRequest(body, signature), deps);

    expect(response.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("rejects a delivery carrying no signature header", async () => {
    const { dependencies: deps, revalidate } = dependencies();

    const response = await handleCatalogWebhook(webhookRequest(BODY, null), deps);

    expect(response.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
  });

  // A bare 401 left a real misconfiguration undiagnosable in production, so each
  // rejection names its cause — and only its cause: the signature and body are
  // caller-controlled and the body carries store data, so neither is logged.
  it.each([
    ["missing-signature", BODY, null],
    ["malformed-signature", BODY, "abc123"],
    ["malformed-signature", BODY, "z".repeat(64)],
    ["signature-mismatch", BODY, sign(BODY, "not-the-secret")],
  ])("logs %s as the rejection reason, and nothing else", async (reason, body, signature) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { dependencies: deps } = dependencies();

    await handleCatalogWebhook(webhookRequest(body, signature), deps);

    expect(warn).toHaveBeenCalledExactlyOnceWith("[catalog] tiendanube webhook rejected", { reason });
    warn.mockRestore();
  });

  it("logs nothing for an authentic delivery", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { dependencies: deps } = dependencies();

    await handleCatalogWebhook(webhookRequest(BODY, sign(BODY)), deps);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // The provider serialises `store_id` as a string on some deliveries and a
  // number on others, so the handler must verify the bytes it actually
  // received rather than anything re-serialised from a parsed body.
  it.each([
    ['{"store_id":"8176730","event":"product/updated","id":366252433}', "a string store_id"],
    ['{"store_id":8176730,"event":"product/updated","id":366252433}', "a number store_id"],
    ["not json at all", "a body that is not JSON"],
  ])("accepts %s when the signature matches the raw bytes", async (body, label) => {
    void label;
    const { dependencies: deps, revalidate } = dependencies();

    const response = await handleCatalogWebhook(webhookRequest(body, sign(body)), deps);

    expect(response.status).toBe(204);
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith("tiendanube-catalog");
  });

  // The client secret is app-scoped, so the same app installed on a test store
  // signs its deliveries with the identical secret. Without this check, editing
  // stock in a test store would invalidate the production cache.
  it.each([
    ['{"store_id":9999999,"event":"product/updated","id":1}', "a number store_id"],
    ['{"store_id":"9999999","event":"product/updated","id":1}', "a string store_id"],
  ])("accepts but ignores an authentic delivery naming another store, with %s", async (body, label) => {
    void label;
    const { dependencies: deps, revalidate } = dependencies();

    const response = await handleCatalogWebhook(webhookRequest(body, sign(body)), deps);

    expect(response.status).toBe(204);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("stays idempotent across the duplicate deliveries the provider documents", async () => {
    const { dependencies: deps, revalidate } = dependencies();
    const signature = sign(BODY);

    for (let delivery = 0; delivery < 3; delivery += 1) {
      const response = await handleCatalogWebhook(webhookRequest(BODY, signature), deps);
      expect(response.status).toBe(204);
    }

    expect(revalidate).toHaveBeenCalledTimes(3);
    expect(revalidate).toHaveBeenLastCalledWith("tiendanube-catalog");
  });
});

describe("handleCatalogWebhook product hook", () => {
  function hooked() {
    const onProductUpdated = vi.fn();
    const { dependencies: deps, revalidate } = dependencies();
    return { deps: { ...deps, onProductUpdated }, onProductUpdated, revalidate };
  }

  it("reports the product id of an authentic product/updated delivery, after revalidating", async () => {
    const { deps, onProductUpdated, revalidate } = hooked();

    const response = await handleCatalogWebhook(webhookRequest(BODY, sign(BODY)), deps);

    expect(response.status).toBe(204);
    expect(onProductUpdated).toHaveBeenCalledExactlyOnceWith(366252433);
    expect(revalidate.mock.invocationCallOrder[0]).toBeLessThan(onProductUpdated.mock.invocationCallOrder[0]!);
  });

  it("accepts the id as a string, like store_id", async () => {
    const { deps, onProductUpdated } = hooked();
    const body = JSON.stringify({ store_id: "8176730", event: "product/updated", id: "42" });

    await handleCatalogWebhook(webhookRequest(body, sign(body)), deps);

    expect(onProductUpdated).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("still reports when the event name is absent", async () => {
    const { deps, onProductUpdated } = hooked();
    const body = JSON.stringify({ store_id: 8176730, id: 7 });

    await handleCatalogWebhook(webhookRequest(body, sign(body)), deps);

    expect(onProductUpdated).toHaveBeenCalledExactlyOnceWith(7);
  });

  it.each([
    ["no id", JSON.stringify({ store_id: 8176730, event: "product/updated" })],
    ["a non-numeric id", JSON.stringify({ store_id: 8176730, event: "product/updated", id: "abc" })],
    ["a zero id", JSON.stringify({ store_id: 8176730, event: "product/updated", id: 0 })],
    ["another event", JSON.stringify({ store_id: 8176730, event: "product/deleted", id: 5 })],
    ["a body that is not JSON", "not json at all"],
    ["another store", JSON.stringify({ store_id: 1, event: "product/updated", id: 5 })],
  ])("does not report a delivery with %s, yet keeps the cache invalidation behaviour", async (label, body) => {
    void label;
    const { deps, onProductUpdated, revalidate } = hooked();

    const response = await handleCatalogWebhook(webhookRequest(body, sign(body)), deps);

    expect(response.status).toBe(204);
    expect(onProductUpdated).not.toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledTimes(label === "another store" ? 0 : 1);
  });

  it("never reports an unauthentic delivery", async () => {
    const { deps, onProductUpdated } = hooked();

    const response = await handleCatalogWebhook(webhookRequest(BODY, "0".repeat(64)), deps);

    expect(response.status).toBe(401);
    expect(onProductUpdated).not.toHaveBeenCalled();
  });

  // A throwing hook must not become a 500: the provider would retry the
  // delivery for 48 hours over a failure that is not the delivery's fault.
  it("answers 204 even when the hook throws", async () => {
    const { deps, onProductUpdated } = hooked();
    onProductUpdated.mockImplementation(() => { throw new Error("boom"); });

    const response = await handleCatalogWebhook(webhookRequest(BODY, sign(BODY)), deps);

    expect(response.status).toBe(204);
  });
});

describe("readCatalogWebhookSecret", () => {
  it("reads and trims the configured secret", () => {
    expect(readCatalogWebhookSecret({ TIENDANUBE_APP_CLIENT_SECRET: "  secret  " })).toBe("secret");
  });

  it.each([{}, { TIENDANUBE_APP_CLIENT_SECRET: "" }, { TIENDANUBE_APP_CLIENT_SECRET: "   " }])(
    "names the missing variable instead of failing anonymously",
    (environment) => {
      expect(() => readCatalogWebhookSecret(environment)).toThrow("TIENDANUBE_APP_CLIENT_SECRET");
    },
  );
});
