import { describe, expect, it } from "vitest";
import { parseEmail } from "../email";

describe("parseEmail", () => {
  it("trims surrounding whitespace, which a pasted address often carries", () => {
    expect(parseEmail("  ana@example.com \n")).toBe("ana@example.com");
  });

  it("keeps the casing as typed: the citext column compares case-insensitively", () => {
    // Lowercasing here would only be a second, silent source of truth next to
    // the column's own comparison — and would rewrite what the person typed.
    expect(parseEmail("Ana@Example.COM")).toBe("Ana@Example.COM");
  });

  it.each(["", "   ", "no-at-sign", "a@", "@b.com", "a b@c.com", "a@b"])(
    "rejects %j",
    (value) => {
      expect(parseEmail(value)).toBeNull();
    },
  );

  it("rejects anything over the 254-character address limit", () => {
    const local = "a".repeat(64);
    const tooLong = `${local}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(parseEmail(tooLong)).toBeNull();
  });

  it.each([undefined, null, 42, {}, ["a@b.com"]])("rejects the non-string %j", (value) => {
    expect(parseEmail(value)).toBeNull();
  });
});
