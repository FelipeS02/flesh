import { describe, expect, it } from "vitest";
import {
  currencyExponent,
  formatMoney,
  formatMoneyDecimal,
  parseMoney,
} from "./money";

describe("parseMoney", () => {
  it("parses a wire price string into integer minor units, exactly", () => {
    const result = parseMoney("25.00");

    expect(result).toEqual({ amount: 2500, currency: "ARS" });
  });

  it("never loses precision the way parseFloat(s)*100 would (e.g. 19.99)", () => {
    const result = parseMoney("19.99");

    expect(result.amount).toBe(1999);
  });

  it("pads a short fraction to the currency's exponent", () => {
    const result = parseMoney("5");

    expect(result.amount).toBe(500);
  });

  it("accepts an explicit currency and uses its exponent", () => {
    const result = parseMoney("25.00", "ARS");

    expect(result).toEqual({ amount: 2500, currency: "ARS" });
  });
});

describe("currencyExponent", () => {
  it("defaults to ARS, which has an exponent of 2", () => {
    expect(currencyExponent()).toBe(2);
    expect(currencyExponent("ARS")).toBe(2);
  });

  it("asserts (throws) rather than silently assuming 2 decimals for an unregistered currency", () => {
    expect(() => currencyExponent("CLP")).toThrow(/CLP/);
  });
});

describe("formatMoney", () => {
  it("formats without a thousands separator below 1000 units", () => {
    expect(formatMoney({ amount: 2500, currency: "ARS" })).toBe("$25");
  });

  it("formats with a dot thousands separator", () => {
    expect(formatMoney({ amount: 2_500_000, currency: "ARS" })).toBe("$25.000");
  });

  // Every price in the artboards reads "$27.000", never "$27.000,00" — ARS
  // prices at this scale are whole pesos. Cents are not decoration to drop,
  // though: the transfer discount can produce them, so they are shown
  // whenever they are non-zero and hidden only when they carry no meaning.
  it("omits a zero fraction, which is how the artboards price everything", () => {
    expect(formatMoney({ amount: 2_430_000, currency: "ARS" })).toBe("$24.300");
  });

  it("keeps the fraction when the amount actually has cents", () => {
    expect(formatMoney({ amount: 1_799_999, currency: "ARS" })).toBe(
      "$17.999,99",
    );
  });
});

// The machine-readable half of the pair above. `formatMoney` writes for a
// person and drops a zero fraction; schema.org reads a decimal number and a
// separate `priceCurrency`, so it needs neither the symbol nor the grouping.
describe("formatMoneyDecimal", () => {
  it("writes minor units as a plain decimal, with no symbol or grouping", () => {
    expect(formatMoneyDecimal({ amount: 2_700_000, currency: "ARS" })).toBe(
      "27000.00",
    );
  });

  it("keeps the zero fraction, unlike the display formatter", () => {
    expect(formatMoneyDecimal({ amount: 2500, currency: "ARS" })).toBe("25.00");
  });

  it("round-trips whatever parseMoney read off the wire", () => {
    expect(formatMoneyDecimal(parseMoney("19.99"))).toBe("19.99");
  });
});
