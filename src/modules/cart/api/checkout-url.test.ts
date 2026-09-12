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
});
