// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readMailConfig } from "../mail-config";

const valid = { RESEND_API_KEY: "re_secret", EMAIL_FROM: "FLESH <novedades@flesh.ar>" };

describe("readMailConfig", () => {
  it("returns the key and sender, with no reply-to by default", () => {
    expect(readMailConfig(valid)).toEqual({
      apiKey: "re_secret",
      from: "FLESH <novedades@flesh.ar>",
      replyTo: undefined,
    });
  });

  it("includes an optional reply-to address", () => {
    expect(readMailConfig({ ...valid, EMAIL_REPLY_TO: "hola@flesh.ar" }).replyTo).toBe(
      "hola@flesh.ar",
    );
  });

  it("treats a blank reply-to as unset", () => {
    expect(readMailConfig({ ...valid, EMAIL_REPLY_TO: "  " }).replyTo).toBeUndefined();
  });

  it("names the missing variables without leaking any value", () => {
    expect(() => readMailConfig({ EMAIL_FROM: "FLESH <novedades@flesh.ar>" })).toThrow(
      "Invalid mail configuration: RESEND_API_KEY.",
    );
    expect(() => readMailConfig({ ...valid, EMAIL_REPLY_TO: "not-an-email" })).toThrow(
      /^Invalid mail configuration: EMAIL_REPLY_TO\.$/,
    );
  });
});
