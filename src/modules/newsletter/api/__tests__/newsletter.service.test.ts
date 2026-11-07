import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WELCOME_SUBJECT } from "../../emails/templates/welcome";
import { NewsletterStorageError } from "../subscribers";
import { createRateGuard } from "../rate-guard";
import {
  requestLaunchNotice,
  requestRestockNotice,
  subscribeToNewsletter,
  type NewsletterDependencies,
} from "../newsletter.service";

const ID = "7b1d6f0e-2c1a-4a58-9d3e-5a1f0c2b9e11";
const EMAIL = "ana@example.com";

const CATALOG = [
  {
    productId: 10,
    variants: [
      { productId: 10, variantId: 20, price: { amount: 1, currency: "ARS" }, stockManagement: true, stock: 0 },
      { productId: 10, variantId: 21, price: { amount: 1, currency: "ARS" }, stockManagement: true, stock: 3 },
      { productId: 10, variantId: 22, price: { amount: 1, currency: "ARS" }, stockManagement: false, stock: null },
      { productId: 10, variantId: 23, price: { amount: 1, currency: "ARS" }, stockManagement: true, stock: null },
    ],
  },
  {
    productId: 11,
    variants: [{ productId: 11, variantId: 30, price: { amount: 1, currency: "ARS" }, stockManagement: true, stock: 0 }],
  },
];

// Only the two fields the launch gate reads; the rest of a ProductView is noise here.
const PURCHASABLE = [
  { id: 50, preview: true },
  { id: 51, preview: false },
] as never;

function setup(overrides: Partial<NewsletterDependencies> = {}) {
  const tasks: (() => Promise<void>)[] = [];
  const send = vi.fn(async () => ({ ok: true as const, ids: ["m1"] }));
  const subscribe = vi.fn(async () => ({ status: "created" as "created" | "resubscribed" | "already-active", id: ID }));
  const requestRestock = vi.fn(async () => "created" as "created" | "already-requested");
  const requestLaunch = vi.fn(async () => "created" as "created" | "already-requested");
  const dependencies: NewsletterDependencies = {
    createClient: () => ({}) as SupabaseClient,
    createMailer: () => ({ send, sendBatch: vi.fn() }) as never,
    schedule: (task) => void tasks.push(task),
    getCheckoutProducts: async () => CATALOG,
    getPurchasableProducts: async () => PURCHASABLE,
    clientGuard: createRateGuard({ limit: 5, windowMs: 600_000 }),
    globalGuard: createRateGuard({ limit: 100, windowMs: 600_000 }),
    readClientKey: async () => "client-a",
    isBot: async () => false,
    siteOrigin: () => "https://flesh.test",
    welcomeEmails: true,
    repository: { subscribe, requestRestock, requestLaunch },
    ...overrides,
  };
  const flush = async () => {
    for (const task of tasks.splice(0)) await task();
  };
  return { dependencies, tasks, send, subscribe, requestRestock, requestLaunch, flush };
}

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function loggedText(): string {
  return JSON.stringify(errorLog.mock.calls);
}

describe("subscribeToNewsletter", () => {
  it("subscribes with source 'newsletter' and defers the welcome email past the response", async () => {
    const { dependencies, subscribe, send, tasks, flush } = setup();

    await expect(subscribeToNewsletter({ email: ` ${EMAIL} ` }, dependencies)).resolves.toEqual({ ok: true });

    expect(subscribe).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, source: "newsletter" });
    // Nothing is sent while the shopper waits: it only runs once scheduled work is flushed.
    expect(send).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stores the subscription but schedules no mail while welcome emails are off", async () => {
    const { dependencies, subscribe, send, tasks } = setup({ welcomeEmails: false });

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({ ok: true });

    expect(subscribe).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, source: "newsletter" });
    expect(tasks).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the welcome with the RFC 8058 one-click pair and a token-bearing body link", async () => {
    const { dependencies, send, flush } = setup();

    await subscribeToNewsletter({ email: EMAIL }, dependencies);
    await flush();

    const [message] = send.mock.calls[0] as unknown as [
      { to: string; subject: string; headers: Record<string, string>; react: { props: Record<string, string> } },
    ];
    expect(message.to).toBe(EMAIL);
    expect(message.subject).toBe(WELCOME_SUBJECT);
    expect(message.headers).toEqual({
      "List-Unsubscribe": `<https://flesh.test/api/newsletter/unsubscribe?token=${ID}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(message.react.props).toEqual({
      baseUrl: "https://flesh.test",
      unsubscribeUrl: `https://flesh.test/newsletter/baja?token=${ID}`,
    });
  });

  it("also welcomes an address that comes back after unsubscribing", async () => {
    const { dependencies, subscribe, send, flush } = setup();
    subscribe.mockResolvedValue({ status: "resubscribed", id: ID });

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({ ok: true });
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("answers ok and sends nothing for an already-active address, so existence is never revealed", async () => {
    const { dependencies, subscribe, send, tasks } = setup();
    subscribe.mockResolvedValue({ status: "already-active", id: ID });

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({ ok: true });
    expect(tasks).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { email: "nope" }, { email: 5 }])(
    "reports invalid-email for %j without touching the database",
    async (input) => {
      const { dependencies, subscribe } = setup();
      await expect(subscribeToNewsletter(input, dependencies)).resolves.toEqual({
        ok: false,
        error: "invalid-email",
      });
      expect(subscribe).not.toHaveBeenCalled();
    },
  );

  it("keeps the subscription when the welcome fails, logging only the reason", async () => {
    const { dependencies, send, flush } = setup();
    send.mockResolvedValue({ ok: false, reason: "rate-limited" } as never);

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({ ok: true });
    await flush();

    expect(errorLog).toHaveBeenCalledWith("[newsletter] welcome_failed", { reason: "rate-limited" });
    expect(loggedText()).not.toContain(EMAIL);
  });

  it("swallows a mailer that cannot even be built (missing env) inside the deferred task", async () => {
    const { dependencies, flush } = setup({
      createMailer: () => {
        throw new TypeError("RESEND_API_KEY is missing");
      },
    });

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({ ok: true });
    await expect(flush()).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] welcome_failed", {
      reason: "unexpected_error",
      errorName: "TypeError",
    });
    expect(loggedText()).not.toContain("RESEND_API_KEY");
  });

  it("is unavailable, and logs only the error name, when storage fails", async () => {
    const { dependencies, subscribe, tasks } = setup();
    subscribe.mockRejectedValue(new NewsletterStorageError("subscriber_insert"));

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(tasks).toHaveLength(0);
    expect(errorLog).toHaveBeenCalledWith("[newsletter] unavailable", {
      reason: "unexpected_error",
      errorName: "NewsletterStorageError",
    });
    expect(loggedText()).not.toContain(EMAIL);
  });

  it("refuses a bot before any database work", async () => {
    const { dependencies, subscribe } = setup({ isBot: async () => true });

    await expect(subscribeToNewsletter({ email: EMAIL }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] unavailable", { reason: "bot_detected" });
  });

  it("refuses a client that spent its own budget while another client still gets through", async () => {
    const { dependencies, subscribe } = setup({
      clientGuard: createRateGuard({ limit: 1, windowMs: 600_000 }),
    });

    await subscribeToNewsletter({ email: EMAIL }, dependencies);
    await expect(subscribeToNewsletter({ email: "b@example.com" }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(subscribe).toHaveBeenCalledTimes(1);

    const other = { ...dependencies, readClientKey: async () => "client-b" };
    await expect(subscribeToNewsletter({ email: "c@example.com" }, other)).resolves.toEqual({ ok: true });
  });

  it("trips the global breaker even across distinct clients", async () => {
    const { dependencies } = setup({ globalGuard: createRateGuard({ limit: 1, windowMs: 600_000 }) });

    await subscribeToNewsletter({ email: EMAIL }, dependencies);
    await expect(
      subscribeToNewsletter({ email: "b@example.com" }, { ...dependencies, readClientKey: async () => "client-b" }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
    expect(errorLog).toHaveBeenCalledWith("[newsletter] unavailable", { reason: "rate_limited" });
  });
});

describe("requestRestockNotice", () => {
  const valid = { email: EMAIL, productId: 10, variantId: 20, newsletter: false };

  it("records a request for a sold-out variant and never touches the subscriber list", async () => {
    const { dependencies, requestRestock, subscribe, tasks } = setup();

    await expect(requestRestockNotice(valid, dependencies)).resolves.toEqual({ ok: true, status: "created" });

    expect(requestRestock).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, productId: 10, variantId: 20 });
    expect(subscribe).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it("passes a duplicate request through as already-requested", async () => {
    const { dependencies, requestRestock } = setup();
    requestRestock.mockResolvedValue("already-requested");

    await expect(requestRestockNotice(valid, dependencies)).resolves.toEqual({
      ok: true,
      status: "already-requested",
    });
  });

  it("also subscribes with source 'restock' and welcomes when the consent box is ticked", async () => {
    const { dependencies, subscribe, send, flush } = setup();

    await expect(requestRestockNotice({ ...valid, newsletter: true }, dependencies)).resolves.toEqual({
      ok: true,
      status: "created",
    });
    expect(subscribe).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, source: "restock" });
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still subscribes on a retry whose restock request already exists", async () => {
    const { dependencies, requestRestock, subscribe } = setup();
    requestRestock.mockResolvedValue("already-requested");

    await requestRestockNotice({ ...valid, newsletter: true }, dependencies);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an in-stock variant", { variantId: 21 }],
    ["a variant whose merchant does not track stock", { variantId: 22 }],
    ["a variant that does not exist", { variantId: 999 }],
    ["a real variant under the wrong product", { variantId: 30 }],
    ["an unknown product", { productId: 999 }],
  ])("is unavailable for %s, writing nothing", async (_label, patch) => {
    const { dependencies, requestRestock, subscribe } = setup();

    await expect(requestRestockNotice({ ...valid, ...patch }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(requestRestock).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("treats a tracked variant with unknown stock as sold out, like the catalog does", async () => {
    const { dependencies } = setup();
    await expect(requestRestockNotice({ ...valid, variantId: 23 }, dependencies)).resolves.toEqual({
      ok: true,
      status: "created",
    });
  });

  it("reports invalid-email for a bad address", async () => {
    const { dependencies, requestRestock } = setup();
    await expect(requestRestockNotice({ ...valid, email: "nope" }, dependencies)).resolves.toEqual({
      ok: false,
      error: "invalid-email",
    });
    expect(requestRestock).not.toHaveBeenCalled();
  });

  it.each([
    { ...valid, productId: "10" },
    { ...valid, variantId: -1 },
    { ...valid, variantId: 1.5 },
    { ...valid, newsletter: "yes" },
    { email: EMAIL },
    null,
  ])("is unavailable for malformed input %j", async (input) => {
    const { dependencies, requestRestock } = setup();
    await expect(requestRestockNotice(input, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(requestRestock).not.toHaveBeenCalled();
  });

  it("refuses bots, and spent client budgets, before reading the catalog", async () => {
    const getCheckoutProducts = vi.fn(async () => CATALOG);
    const bot = setup({ isBot: async () => true, getCheckoutProducts });
    await expect(requestRestockNotice(valid, bot.dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });

    const limited = setup({ clientGuard: createRateGuard({ limit: 0, windowMs: 1_000 }), getCheckoutProducts });
    await expect(requestRestockNotice(valid, limited.dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(getCheckoutProducts).not.toHaveBeenCalled();
  });

  it("is unavailable, logging only a name, when the catalog read fails", async () => {
    const { dependencies } = setup({
      getCheckoutProducts: async () => {
        throw new Error("upstream said ana@example.com");
      },
    });
    await expect(requestRestockNotice(valid, dependencies)).resolves.toEqual({ ok: false, error: "unavailable" });
    expect(loggedText()).not.toContain(EMAIL);
  });
});

describe("requestLaunchNotice", () => {
  const valid = { email: EMAIL, productId: 50 };

  it("stores a request for a preview product and never touches the subscriber list", async () => {
    const { dependencies, requestLaunch, subscribe, tasks } = setup();

    await expect(requestLaunchNotice(valid, dependencies)).resolves.toEqual({ ok: true, status: "created" });

    expect(requestLaunch).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, productId: 50 });
    expect(subscribe).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it("passes a duplicate request through as already-requested", async () => {
    const { dependencies, requestLaunch } = setup();
    requestLaunch.mockResolvedValue("already-requested");

    await expect(requestLaunchNotice(valid, dependencies)).resolves.toEqual({
      ok: true,
      status: "already-requested",
    });
  });

  it("refuses a released product, writing nothing, and logs why", async () => {
    const { dependencies, requestLaunch, subscribe } = setup();

    await expect(requestLaunchNotice({ ...valid, productId: 51 }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(requestLaunch).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] unavailable", { reason: "not_preview" });
  });

  it("refuses an unknown product, writing nothing, and logs why", async () => {
    const { dependencies, requestLaunch } = setup();

    await expect(requestLaunchNotice({ ...valid, productId: 999 }, dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(requestLaunch).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[newsletter] unavailable", { reason: "unknown_product" });
  });

  it("reports invalid-email for a bad address", async () => {
    const { dependencies, requestLaunch } = setup();
    await expect(requestLaunchNotice({ ...valid, email: "nope" }, dependencies)).resolves.toEqual({
      ok: false,
      error: "invalid-email",
    });
    expect(requestLaunch).not.toHaveBeenCalled();
  });

  it.each([{ ...valid, productId: "50" }, { ...valid, productId: -1 }, { ...valid, productId: 1.5 }, { email: EMAIL }, null])(
    "is unavailable for malformed input %j",
    async (input) => {
      const { dependencies, requestLaunch } = setup();
      await expect(requestLaunchNotice(input, dependencies)).resolves.toEqual({ ok: false, error: "unavailable" });
      expect(requestLaunch).not.toHaveBeenCalled();
    },
  );

  it("refuses bots, and spent client budgets, before reading the catalog", async () => {
    const getPurchasableProducts = vi.fn(async () => PURCHASABLE);
    const bot = setup({ isBot: async () => true, getPurchasableProducts });
    await expect(requestLaunchNotice(valid, bot.dependencies)).resolves.toEqual({ ok: false, error: "unavailable" });

    const limited = setup({ clientGuard: createRateGuard({ limit: 0, windowMs: 1_000 }), getPurchasableProducts });
    await expect(requestLaunchNotice(valid, limited.dependencies)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(getPurchasableProducts).not.toHaveBeenCalled();
    expect(bot.requestLaunch).not.toHaveBeenCalled();
    expect(limited.requestLaunch).not.toHaveBeenCalled();
  });

  it("is unavailable, logging only a name, when storage fails", async () => {
    const { dependencies, requestLaunch } = setup();
    requestLaunch.mockRejectedValue(new NewsletterStorageError("launch_insert"));
    await expect(requestLaunchNotice(valid, dependencies)).resolves.toEqual({ ok: false, error: "unavailable" });
    expect(loggedText()).not.toContain(EMAIL);
  });
});
