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
