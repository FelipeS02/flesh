import { describe, expect, it } from "vitest";
import { maskBuyerLabel } from "./buyer-profile.mask";

describe("maskBuyerLabel", () => {
  it("renders exactly three bullets per name part, regardless of length", () => {
    expect(maskBuyerLabel({ firstName: "Felipe", lastName: "Saracho", email: "felipe@example.com" })).toBe(
      "Comprar como F••• S•••",
    );
  });

  it("never leaks name length by varying bullet count", () => {
    const short = maskBuyerLabel({ firstName: "Al", lastName: "Xu", email: "a@example.com" });
    const long = maskBuyerLabel({ firstName: "Bartholomew", lastName: "Christopherson", email: "b@example.com" });

    expect(short).toBe("Comprar como A••• X•••");
    expect(long).toBe("Comprar como B••• C•••");
  });

  it("takes an accented first character whole and upper-cases it for Spanish", () => {
    expect(maskBuyerLabel({ firstName: "ñandú", lastName: "Ibarra", email: "n@example.com" })).toBe(
      "Comprar como Ñ••• I•••",
    );
  });

  it("takes an astral first character whole, never splitting a surrogate pair", () => {
    // U+1D400 MATHEMATICAL BOLD CAPITAL A is a single codepoint spanning two UTF-16 code units.
    expect(maskBuyerLabel({ firstName: "\u{1D400}bc", lastName: "Doe", email: "d@example.com" })).toBe(
      "Comprar como \u{1D400}••• D•••",
    );
  });

  it("handles a single-character name part the same way as a long one", () => {
    expect(maskBuyerLabel({ firstName: "O", lastName: "Nguyen", email: "o@example.com" })).toBe(
      "Comprar como O••• N•••",
    );
  });

  it("never includes the email in the output", () => {
    const label = maskBuyerLabel({ firstName: "Felipe", lastName: "Saracho", email: "felipe.saracho@example.com" });

    expect(label).not.toContain("@");
    expect(label).not.toContain("example.com");
  });
});
