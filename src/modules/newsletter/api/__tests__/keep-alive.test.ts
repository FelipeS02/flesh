import { describe, expect, it, vi } from "vitest";
import { handleKeepAlive, type KeepAliveDependencies } from "../keep-alive";

const SECRET = "s3cret-value";

function request(authorization?: string): Request {
  return new Request("https://flesh.test/api/cron/keep-alive", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

function setup(overrides: Partial<KeepAliveDependencies> = {}) {
  const limit = vi.fn().mockResolvedValue({ data: [], error: null });
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  const dependencies: KeepAliveDependencies = {
    cronSecret: SECRET,
    createClient: () => ({ from }) as unknown as ReturnType<KeepAliveDependencies["createClient"]>,
    ...overrides,
  };
  return { dependencies, from, select, limit };
}

describe("handleKeepAlive", () => {
  it("rejects every caller when CRON_SECRET is unset, without querying", async () => {
    // `Bearer undefined` must never authorize: an unset secret is a closed door.
    const { dependencies, from } = setup({ cronSecret: undefined });
    const response = await handleKeepAlive(request("Bearer undefined"), dependencies);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects every caller when CRON_SECRET is empty, without querying", async () => {
    const { dependencies, from } = setup({ cronSecret: "" });
    const response = await handleKeepAlive(request("Bearer "), dependencies);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a request with no authorization header", async () => {
    const { dependencies, from } = setup();
    const response = await handleKeepAlive(request(), dependencies);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer of the same length, without querying", async () => {
    const { dependencies, from } = setup();
    const response = await handleKeepAlive(request(`Bearer ${"x".repeat(SECRET.length)}`), dependencies);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer of a different length, without querying", async () => {
    const { dependencies, from } = setup();
    const response = await handleKeepAlive(request("Bearer nope"), dependencies);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("runs one cheap select on newsletter_subscribers and answers 204 with the right bearer", async () => {
    const { dependencies, from, select, limit } = setup();
    const response = await handleKeepAlive(request(`Bearer ${SECRET}`), dependencies);
    expect(response.status).toBe(204);
    expect(from).toHaveBeenCalledExactlyOnceWith("newsletter_subscribers");
    expect(select).toHaveBeenCalledExactlyOnceWith("id");
    expect(limit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("answers 503 without leaking details when Supabase returns an error", async () => {
    const { dependencies, limit } = setup();
    limit.mockResolvedValue({ data: null, error: { message: "relation secret_table missing" } });
    const response = await handleKeepAlive(request(`Bearer ${SECRET}`), dependencies);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret_table");
  });

  it("answers 503 without leaking details when the client throws", async () => {
    const { dependencies } = setup({
      createClient: () => {
        throw new Error("SUPABASE_SECRET_KEY is wrong");
      },
    });
    const response = await handleKeepAlive(request(`Bearer ${SECRET}`), dependencies);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("answers 503 when the query rejects", async () => {
    const { dependencies, limit } = setup();
    limit.mockRejectedValue(new Error("network down"));
    const response = await handleKeepAlive(request(`Bearer ${SECRET}`), dependencies);
    expect(response.status).toBe(503);
  });
});
