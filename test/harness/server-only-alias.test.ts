import { describe, expect, it } from "vitest";
import { getMarker } from "../fixtures/server-only-consumer";

describe("Vitest + RTL harness — server-only alias resolution", () => {
  it("resolves a module that imports the server-only package, and runs its logic", () => {
    expect(getMarker("catalog")).toBe("server-only:catalog");
  });

  it("computes a different value for a different scope, proving real logic ran", () => {
    expect(getMarker("source")).toBe("server-only:source");
  });
});
