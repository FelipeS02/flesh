import { describe, expect, it } from "vitest";
import { parseRichText } from "../rich-text";

describe("parseRichText", () => {
  it("returns no segments for empty input", () => {
    expect(parseRichText("")).toEqual([]);
  });

  it("returns a single plain segment for text with no markers", () => {
    expect(parseRichText("plain text")).toEqual([{ text: "plain text", strong: false }]);
  });

  it("parses a fully bold segment", () => {
    expect(parseRichText("**bold**")).toEqual([{ text: "bold", strong: true }]);
  });

  it("parses plain text around one bold run", () => {
    expect(parseRichText("SITIO EN **CONSTRUCCIÓN**")).toEqual([
      { text: "SITIO EN ", strong: false },
      { text: "CONSTRUCCIÓN", strong: true },
    ]);
  });

  it("parses multiple bold runs", () => {
    expect(parseRichText("**a** and **b**")).toEqual([
      { text: "a", strong: true },
      { text: " and ", strong: false },
      { text: "b", strong: true },
    ]);
  });

  it("treats an unmatched marker as literal text instead of crashing or swallowing it", () => {
    expect(parseRichText("volvemos **pronto")).toEqual([
      { text: "volvemos **pronto", strong: false },
    ]);
  });

  it("treats consecutive markers with nothing between them as literal text", () => {
    expect(parseRichText("****")).toEqual([{ text: "****", strong: false }]);
  });

  it("parses a marker pair that starts and ends inside a single word", () => {
    expect(parseRichText("un**bel**ievable")).toEqual([
      { text: "un", strong: false },
      { text: "bel", strong: true },
      { text: "ievable", strong: false },
    ]);
  });
});
