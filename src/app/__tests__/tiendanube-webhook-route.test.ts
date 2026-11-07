import { beforeEach, describe, expect, it, vi } from "vitest";

const after = vi.fn();
const handleCatalogWebhook = vi.fn();
const dispatchRestockNotices = vi.fn();

vi.mock("next/server", () => ({ after }));
vi.mock("@/modules/catalog", () => ({ handleCatalogWebhook }));
vi.mock("@/modules/newsletter", () => ({ dispatchRestockNotices }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/webhooks/tiendanube", () => {
  it("hands the request to the catalog handler and returns its response", async () => {
    const response = new Response(null, { status: 204 });
    handleCatalogWebhook.mockResolvedValue(response);
    const { POST } = await import("../api/webhooks/tiendanube/route");
    const request = new Request("https://flesh.test/api/webhooks/tiendanube", { method: "POST" });

    await expect(POST(request)).resolves.toBe(response);
    expect(handleCatalogWebhook.mock.calls[0]![0]).toBe(request);
  });

  // The 204 has to go out inside the provider three-second window, so the
  // dispatch is only scheduled here, never awaited by the handler.
  it("defers the restock dispatch with after() instead of running it inline", async () => {
    handleCatalogWebhook.mockResolvedValue(new Response(null, { status: 204 }));
    const { POST } = await import("../api/webhooks/tiendanube/route");
    await POST(new Request("https://flesh.test/api/webhooks/tiendanube", { method: "POST" }));
    const { onProductUpdated } = handleCatalogWebhook.mock.calls[0]![1] as { onProductUpdated: (id: number) => void };

    onProductUpdated(42);

    expect(dispatchRestockNotices).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    await (after.mock.calls[0]![0] as () => Promise<void>)();
    expect(dispatchRestockNotices).toHaveBeenCalledExactlyOnceWith(42);
  });
});
