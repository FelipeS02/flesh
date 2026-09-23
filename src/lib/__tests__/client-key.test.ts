import { describe, expect, it } from "vitest";
import { readClientIp, readClientKey } from "../client-key";

describe("readClientIp", () => {
  it("prefers x-vercel-forwarded-for, which a proxy placed in front of Vercel cannot overwrite", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(readClientIp(headers)).toBe("203.0.113.7");
  });

  it("returns null rather than a placeholder when no address is forwarded", () => {
    expect(readClientIp(new Headers())).toBeNull();
  });
});

describe("readClientKey", () => {
  it("takes the first hop of x-forwarded-for, which is the client the platform saw", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(readClientKey(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(readClientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("degrades to one shared bucket when no address is forwarded", () => {
    expect(readClientKey(new Headers())).toBe("unknown");
  });

  it("ignores a blank forwarded header rather than keying every visitor on an empty string", () => {
    expect(readClientKey(new Headers({ "x-forwarded-for": "   " }))).toBe("unknown");
  });
});
