import { describe, expect, it } from "vitest";
import { constantTimeEqual, signToken, verifyToken } from "./session";

const SECRET = "correct-horse-battery-staple";

describe("signToken", () => {
  it("produces an '<exp>.<hex hmac>' token", async () => {
    const token = await signToken(1_000, SECRET);

    expect(token).toMatch(/^1000\.[0-9a-f]+$/);
  });

  it("is deterministic for the same expiry and secret", async () => {
    const [a, b] = await Promise.all([signToken(1_000, SECRET), signToken(1_000, SECRET)]);

    expect(a).toBe(b);
  });

  it("differs when the secret differs", async () => {
    const [a, b] = await Promise.all([signToken(1_000, SECRET), signToken(1_000, "other-secret")]);

    expect(a).not.toBe(b);
  });
});

describe("verifyToken", () => {
  it("accepts a token that has not expired", async () => {
    const token = await signToken(Date.now() + 60_000, SECRET);

    await expect(verifyToken(token, SECRET, Date.now())).resolves.toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await signToken(Date.now() - 1, SECRET);

    await expect(verifyToken(token, SECRET, Date.now())).resolves.toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await signToken(Date.now() + 60_000, SECRET);
    const [exp] = token.split(".");
    const tampered = `${exp}.${"0".repeat(64)}`;

    await expect(verifyToken(tampered, SECRET, Date.now())).resolves.toBe(false);
  });

  it("rejects a token verified against the wrong secret", async () => {
    const token = await signToken(Date.now() + 60_000, SECRET);

    await expect(verifyToken(token, "wrong-secret", Date.now())).resolves.toBe(false);
  });

  it.each([
    ["no dot at all", "12345"],
    ["more than one dot", "123.abc.def"],
    ["a non-numeric expiry", "not-a-number.abcdef"],
    ["a non-hex signature", "9999999999999.not-hex-zzz"],
    ["an empty string", ""],
  ])("rejects a malformed token: %s", async (_label, token) => {
    await expect(verifyToken(token, SECRET, Date.now())).resolves.toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("is true for identical strings", () => {
    expect(constantTimeEqual("hunter2", "hunter2")).toBe(true);
  });

  it("is false for a different value of the same length", () => {
    expect(constantTimeEqual("hunter2", "hunter3")).toBe(false);
  });

  it("is false for values of different length", () => {
    expect(constantTimeEqual("hunter2", "hunter2x")).toBe(false);
  });

  it("is true for two empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
