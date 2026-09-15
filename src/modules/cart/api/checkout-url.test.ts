import { describe, expect, it } from "vitest";
import { isSafeCheckoutUrl } from "./checkout-url";

describe("isSafeCheckoutUrl", () => {
  it.each([
    "https://checkout.example.test/order/1",
    "https://any-host.example.test/path?token=opaque",
  ])("accepts an absolute HTTPS URL without credentials: %s", (value) => {
    expect(isSafeCheckoutUrl(value)).toBe(true);
  });

  it.each([
    "/relative",
    "http://checkout.example.test/order/1",
    "https://user:password@checkout.example.test/order/1",
    "not a URL",
  ])("refuses an unsafe URL: %s", (value) => {
    expect(isSafeCheckoutUrl(value)).toBe(false);
  });

  it("accepts only the configured checkout host when one is required", () => {
    expect(
      isSafeCheckoutUrl(
        "https://checkout.example.test/order/1",
        "checkout.example.test",
      ),
    ).toBe(true);
    expect(
      isSafeCheckoutUrl(
        "https://evil.checkout.example.test/order/1",
        "checkout.example.test",
      ),
    ).toBe(false);
    expect(
      isSafeCheckoutUrl(
        "https://checkout.example.test.evil.test/order/1",
        "checkout.example.test",
      ),
    ).toBe(false);
  });
});
