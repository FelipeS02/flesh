import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsletterStorageError } from "../subscribers";
import { handleResendWebhook, type ResendWebhookDependencies } from "../resend-webhook";

const SECRET = "whsec_test";

function bounced(type: string, to: string[] = ["dead@example.com"]) {
  return {
    type: "email.bounced",
    created_at: "2026-11-03T12:00:00.000Z",
    data: { to, email_id: "em_1", bounce: { type, subType: "General", message: "mailbox unavailable" } },
  };
}

function post(body = "{}"): Request {
  return new Request("https://flesh.test/api/webhooks/resend", {
    method: "POST",
    headers: { "svix-id": "msg_1", "svix-timestamp": "1", "svix-signature": "v1,abc" },
    body,
  });
}

function setup(verified: unknown = bounced("Permanent"), overrides: Partial<ResendWebhookDependencies> = {}) {
  const verify = vi.fn<ResendWebhookDependencies["verify"]>(() => verified);
  const forgetAddress = vi.fn<ResendWebhookDependencies["repository"]["forgetAddress"]>(async () => {});
  const unsubscribeAddress = vi.fn<ResendWebhookDependencies["repository"]["unsubscribeAddress"]>(async () => {});
  const createClient = vi.fn(() => ({}) as SupabaseClient);
  const dependencies: ResendWebhookDependencies = {
    webhookSecret: () => SECRET,
    verify,
    createClient,
    repository: { forgetAddress, unsubscribeAddress },
    ...overrides,
  };
  return { dependencies, verify, forgetAddress, unsubscribeAddress, createClient };
}

afterEach(() => vi.restoreAllMocks());

describe("handleResendWebhook", () => {
  it("forgets the bounced address and answers 204", async () => {
    const { dependencies, forgetAddress } = setup();

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(forgetAddress).toHaveBeenCalledTimes(1);
    expect(forgetAddress).toHaveBeenCalledWith(expect.anything(), "dead@example.com");
  });

  it("verifies the raw body bytes with the configured secret", async () => {
    const { dependencies, verify } = setup();
    const raw = '{"type":  "email.bounced"}';

    await handleResendWebhook(post(raw), dependencies);

    expect(verify).toHaveBeenCalledWith(raw, expect.any(Headers), SECRET);
    expect(verify.mock.calls[0]?.[1].get("svix-id")).toBe("msg_1");
  });

  it("matches the permanent bounce type case-insensitively", async () => {
    const { dependencies, forgetAddress } = setup(bounced("permanent"));

    expect((await handleResendWebhook(post(), dependencies)).status).toBe(204);
    expect(forgetAddress).toHaveBeenCalledTimes(1);
  });

  it("forgets every recipient of the message", async () => {
    const { dependencies, forgetAddress } = setup(bounced("Permanent", ["a@example.com", "b@example.com"]));

    await handleResendWebhook(post(), dependencies);

    expect(forgetAddress.mock.calls.map(([, email]) => email)).toEqual(["a@example.com", "b@example.com"]);
  });

  it.each(["Transient", "Undetermined"])("ignores a %s bounce without touching storage", async (type) => {
    const { dependencies, forgetAddress, createClient } = setup(bounced(type));

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(204);
    expect(forgetAddress).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("ignores other event types without touching storage", async () => {
    const { dependencies, forgetAddress, createClient } = setup({
      type: "email.delivered",
      created_at: "2026-11-03T12:00:00.000Z",
      data: { to: ["ok@example.com"], email_id: "em_2" },
    });

    expect((await handleResendWebhook(post(), dependencies)).status).toBe(204);
    expect(forgetAddress).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("answers 400 and never touches storage when the signature is invalid", async () => {
    const { dependencies, forgetAddress, createClient } = setup(undefined, {
      verify: () => {
        throw new Error("bad signature");
      },
    });

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(400);
    expect(forgetAddress).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("answers 400 when the verified payload lacks the shape the handler relies on", async () => {
    const { dependencies, forgetAddress } = setup({ type: "email.bounced", data: { to: "not-a-list" } });

    expect((await handleResendWebhook(post(), dependencies)).status).toBe(400);
    expect(forgetAddress).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("answers 503 when the secret is %j, before verifying anything", async (secret) => {
    const { dependencies, verify, forgetAddress } = setup(undefined, { webhookSecret: () => secret });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
    expect(forgetAddress).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).toContain("RESEND_WEBHOOK_SECRET");
  });

  it("answers 503 on a storage failure and logs neither the address nor the payload", async () => {
    const forgetAddress = vi.fn(async () => {
      throw new NewsletterStorageError("forget_subscriber");
    });
    const { dependencies } = setup(undefined, { repository: { forgetAddress, unsubscribeAddress: vi.fn(async () => {}) } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(503);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("NewsletterStorageError");
    expect(logged).not.toContain("dead@example.com");
    expect(logged).not.toContain("mailbox unavailable");
  });
});

describe("handleResendWebhook spam complaints", () => {
  function complained(to: unknown = ["angry@example.com"]) {
    return { type: "email.complained", created_at: "2026-11-03T12:00:00.000Z", data: { to, email_id: "em_3" } };
  }

  it("unsubscribes each recipient and never deletes", async () => {
    const unsubscribeAddress = vi.fn<ResendWebhookDependencies["repository"]["unsubscribeAddress"]>(async () => {});
    const { dependencies, forgetAddress } = setup(complained(["a@example.com", "b@example.com"]), {
      repository: { forgetAddress: vi.fn(async () => {}), unsubscribeAddress },
    });

    const response = await handleResendWebhook(post(), dependencies);

    expect(response.status).toBe(204);
    expect(unsubscribeAddress.mock.calls.map(([, email]) => email)).toEqual(["a@example.com", "b@example.com"]);
    expect(forgetAddress).not.toHaveBeenCalled();
  });

  it("answers 400 for a malformed complaint without touching storage", async () => {
    const unsubscribeAddress = vi.fn<ResendWebhookDependencies["repository"]["unsubscribeAddress"]>(async () => {});
    const { dependencies, createClient } = setup(complained("not-a-list"), {
      repository: { forgetAddress: vi.fn(async () => {}), unsubscribeAddress },
    });

    expect((await handleResendWebhook(post(), dependencies)).status).toBe(400);
    expect(unsubscribeAddress).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("answers 503 on a storage failure and logs no address", async () => {
    const unsubscribeAddress = vi.fn<ResendWebhookDependencies["repository"]["unsubscribeAddress"]>(async () => {
      throw new NewsletterStorageError("unsubscribe_address");
    });
    const { dependencies } = setup(complained(), {
      repository: { forgetAddress: vi.fn(async () => {}), unsubscribeAddress },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await handleResendWebhook(post(), dependencies)).status).toBe(503);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("NewsletterStorageError");
    expect(logged).not.toContain("angry@example.com");
  });
});
