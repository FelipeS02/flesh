import { describe, expect, it, vi } from "vitest";
import { describeCheckoutFailure, logCheckoutFailure } from "../checkout.diagnostics";
import { TiendanubeCheckoutError } from "../checkout.tiendanube";

describe("describeCheckoutFailure", () => {
  it("carries the adapter's own sanitized detail through unchanged", () => {
    const error = new TiendanubeCheckoutError({ reason: "http_status", status: 503 });

    expect(describeCheckoutFailure(error)).toEqual({ reason: "http_status", status: 503 });
  });

  // The config is read inside the same try that swallows everything, so a
  // missing env var arrives here as a ZodError. Naming the constructor is what
  // separates "the shop is misconfigured" from "the provider is down" — the
  // two failures a shopper reports identically.
  it("names the constructor of an error the adapter never wrapped", () => {
    class ZodError extends Error {}

    expect(describeCheckoutFailure(new ZodError("bad env"))).toEqual({
      reason: "unexpected_error",
      errorName: "ZodError",
    });
  });

  it("describes a thrown non-error without assuming it has a name", () => {
    expect(describeCheckoutFailure("boom")).toEqual({ reason: "unexpected_error", errorName: "String" });
  });

  // An upstream message is the one place the access token has been observed
  // travelling, so it must never reach a log line either.
  it("never carries an upstream message into the description", () => {
    const description = describeCheckoutFailure(new Error("socket with secret-token"));

    expect(JSON.stringify(description)).not.toContain("secret-token");
  });
});

describe("logCheckoutFailure", () => {
  it("writes one server-side line the shopper's generic outcome cannot express", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logCheckoutFailure(new TiendanubeCheckoutError({ reason: "unsafe_checkout_url", expectedHost: "checkout.example.com", receivedHost: "checkout.flesh.ar" }));

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]).toEqual([
      "[checkout] unavailable",
      { reason: "unsafe_checkout_url", expectedHost: "checkout.example.com", receivedHost: "checkout.flesh.ar" },
    ]);
    consoleError.mockRestore();
  });
});
