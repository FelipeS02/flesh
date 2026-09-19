import { describe, expect, it } from "vitest";
import { formatClickId, subdomainIndexFor } from "./browser-ids";

const CLICK_ID = "IwAR1abcDEF_ghi-JKL";
const NOW = 1_726_700_000_000;

describe("formatClickId", () => {
  it("builds Meta's documented _fbc value", () => {
    expect(formatClickId(CLICK_ID, NOW, 1)).toBe(`fb.1.${NOW}.${CLICK_ID}`);
  });

  it("carries the subdomain index it was given", () => {
    expect(formatClickId(CLICK_ID, NOW, 2)).toBe(`fb.2.${NOW}.${CLICK_ID}`);
  });

  // The value is assembled into a cookie and later into a JSON payload, so a
  // click id carrying a separator or a quote is refused rather than escaped.
  it("refuses a click id outside the safe alphabet", () => {
    expect(formatClickId("abc;def", NOW, 1)).toBeNull();
    expect(formatClickId('ab"c', NOW, 1)).toBeNull();
    expect(formatClickId("ab.c", NOW, 1)).toBeNull();
  });

  it("refuses an empty or blank click id", () => {
    expect(formatClickId("", NOW, 1)).toBeNull();
    expect(formatClickId("   ", NOW, 1)).toBeNull();
  });

  it("refuses an implausibly long click id", () => {
    expect(formatClickId("a".repeat(513), NOW, 1)).toBeNull();
  });
});

// Meta's own examples define the index by counting labels: "com" is 0,
// "example.com" is 1, "www.example.com" is 2. The rule is naive about
// multi-part suffixes, so a .com.ar host lands on 2, and that is deliberate —
// matching Meta's arithmetic matters more here than being right about
// registrable domains.
describe("subdomainIndexFor", () => {
  it("counts labels the way Meta's examples do", () => {
    expect(subdomainIndexFor("example.com")).toBe(1);
    expect(subdomainIndexFor("www.example.com")).toBe(2);
    expect(subdomainIndexFor("flesh.com.ar")).toBe(2);
  });

  it("handles a single-label host without going negative", () => {
    expect(subdomainIndexFor("localhost")).toBe(0);
    expect(subdomainIndexFor("")).toBe(0);
  });
});
