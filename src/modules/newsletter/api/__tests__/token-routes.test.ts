import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleResubscribe, handleUnsubscribe, type TokenRouteDependencies } from "../token-routes";

const ID = "7b1d6f0e-2c1a-4a58-9d3e-5a1f0c2b9e11";

function post(query: string, body?: string): Request {
  return new Request(`https://flesh.test/api/newsletter/unsubscribe${query}`, {
    method: "POST",
    headers: body === undefined ? {} : { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function setup(overrides: Partial<TokenRouteDependencies> = {}) {
  const unsubscribe = vi.fn(async () => "done" as "done" | "invalid");
  const resubscribe = vi.fn(async () => "done" as "done" | "invalid");
  const dependencies: TokenRouteDependencies = {
    createClient: () => ({}) as SupabaseClient,
    repository: { unsubscribe, resubscribe },
    ...overrides,
  };
  return { dependencies, unsubscribe, resubscribe };
}

afterEach(() => vi.restoreAllMocks());

describe("handleUnsubscribe", () => {
  it("answers 204 with an empty body when the token unsubscribes", async () => {
    const { dependencies, unsubscribe } = setup();

    const response = await handleUnsubscribe(post(`?token=${ID}`), dependencies);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(unsubscribe).toHaveBeenCalledWith(expect.anything(), ID);
  });

  it("accepts the RFC 8058 one-click body without requiring it", async () => {
    const { dependencies } = setup();

    const withBody = await handleUnsubscribe(post(`?token=${ID}`, "List-Unsubscribe=One-Click"), dependencies);
    const withoutBody = await handleUnsubscribe(post(`?token=${ID}`), dependencies);

    expect([withBody.status, withoutBody.status]).toEqual([204, 204]);
  });

  it("answers 404 for an unknown token and for a missing one, with an empty body", async () => {
    const { dependencies, unsubscribe } = setup();
    unsubscribe.mockResolvedValue("invalid");

    const unknown = await handleUnsubscribe(post(`?token=${ID}`), dependencies);
    const missing = await handleUnsubscribe(post(""), dependencies);

    expect([unknown.status, missing.status]).toEqual([404, 404]);
    expect(await unknown.text()).toBe("");
    // A missing token still goes to the repository's own uuid check — one rule, one place.
    expect(unsubscribe).toHaveBeenLastCalledWith(expect.anything(), "");
  });

  it("answers 503 with an empty body when storage fails, without logging the token", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { dependencies, unsubscribe } = setup();
    unsubscribe.mockRejectedValue(new Error(`row ${ID} exploded`));

    const response = await handleUnsubscribe(post(`?token=${ID}`), dependencies);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(ID);
  });

  it("answers 503 when the client cannot even be built (missing env)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dependencies } = setup({
      createClient: () => {
        throw new Error("Invalid Supabase configuration");
      },
    });

    expect((await handleUnsubscribe(post(`?token=${ID}`), dependencies)).status).toBe(503);
  });
});

describe("handleResubscribe", () => {
  it("answers 204, 404 and 503 from the resubscribe repository", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dependencies, resubscribe } = setup();

    expect((await handleResubscribe(post(`?token=${ID}`), dependencies)).status).toBe(204);
    resubscribe.mockResolvedValueOnce("invalid");
    expect((await handleResubscribe(post(`?token=${ID}`), dependencies)).status).toBe(404);
    resubscribe.mockRejectedValueOnce(new Error("boom"));
    expect((await handleResubscribe(post(`?token=${ID}`), dependencies)).status).toBe(503);
  });
});
