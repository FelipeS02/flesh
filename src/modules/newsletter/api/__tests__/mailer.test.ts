// @vitest-environment node
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { createResendMailer, MAX_BATCH_SIZE, type ResendLikeClient } from "../mailer";

const config = { from: "FLESH <novedades@flesh.ar>", replyTo: "hola@flesh.ar" };
const react = createElement("div", null, "hola");
const message = { to: "ana@example.com", subject: "Asunto", react };

function fakeClient(overrides: Partial<ResendLikeClient> = {}) {
  const send = vi.fn().mockResolvedValue({ data: { id: "id-1" }, error: null });
  const sendBatch = vi.fn().mockResolvedValue({ data: { data: [{ id: "a" }, { id: "b" }] }, error: null });
  const client: ResendLikeClient = { send, sendBatch, ...overrides };
  return { client, send, sendBatch };
}

describe("createResendMailer", () => {
  it("sends one message with from and reply-to taken from config", async () => {
    const { client, send } = fakeClient();
    const result = await createResendMailer(config, client).send({
      ...message,
      headers: { "List-Unsubscribe": "<https://flesh.ar/u>" },
    });

    expect(result).toEqual({ ok: true, ids: ["id-1"] });
    expect(send).toHaveBeenCalledWith({
      from: config.from,
      replyTo: config.replyTo,
      to: "ana@example.com",
      subject: "Asunto",
      react,
      headers: { "List-Unsubscribe": "<https://flesh.ar/u>" },
    });
  });

  it("sends a batch with the idempotency key and collects every id", async () => {
    const { client, sendBatch } = fakeClient();
    const result = await createResendMailer(config, client).sendBatch(
      [message, { ...message, to: "bea@example.com" }],
      { idempotencyKey: "campaign-1/0" },
    );

    expect(result).toEqual({ ok: true, ids: ["a", "b"] });
    const [payload, options] = sendBatch.mock.calls[0];
    expect(payload.map((m: { to: string }) => m.to)).toEqual(["ana@example.com", "bea@example.com"]);
    expect(payload[0]).toMatchObject({ from: config.from, replyTo: config.replyTo });
    expect(options).toEqual({ idempotencyKey: "campaign-1/0" });
  });

  it("rejects a batch over the provider cap without calling it", async () => {
    const { client, sendBatch } = fakeClient();
    const tooMany = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => message);

    const result = await createResendMailer(config, client).sendBatch(tooMany, {
      idempotencyKey: "k",
    });

    expect(result).toEqual({ ok: false, reason: "batch-too-large" });
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("maps provider errors to a sanitized reason, never the raw message", async () => {
    const rateLimited = fakeClient({
      send: vi.fn().mockResolvedValue({
        data: null,
        error: { name: "rate_limit_exceeded", message: "ana@example.com is throttled" },
      }),
    });
    const rejected = fakeClient({
      send: vi.fn().mockResolvedValue({
        data: null,
        error: { name: "validation_error", message: "bad address ana@example.com" },
      }),
    });

    const first = await createResendMailer(config, rateLimited.client).send(message);
    const second = await createResendMailer(config, rejected.client).send(message);

    expect(first).toEqual({ ok: false, reason: "rate-limited" });
    expect(second).toEqual({ ok: false, reason: "rejected" });
    expect(JSON.stringify([first, second])).not.toContain("example.com");
  });

  it("maps a thrown error to network without leaking it", async () => {
    const { client } = fakeClient({
      send: vi.fn().mockRejectedValue(new Error("connect ECONNRESET ana@example.com")),
    });

    const result = await createResendMailer(config, client).send(message);

    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("treats a response with neither data nor error as a failure", async () => {
    const { client } = fakeClient({ send: vi.fn().mockResolvedValue({ data: null, error: null }) });

    expect(await createResendMailer(config, client).send(message)).toEqual({
      ok: false,
      reason: "rejected",
    });
  });
});
