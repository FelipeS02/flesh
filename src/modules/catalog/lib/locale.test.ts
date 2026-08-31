import { describe, expect, it } from "vitest";
import { pick } from "./locale";

describe("pick", () => {
  it("resolves the 'es' key by default — UI copy is Spanish", () => {
    const result = pick({ en: "Tee", es: "Remera", pt: "Camiseta" });

    expect(result).toBe("Remera");
  });

  it("resolves an explicit locale when given one", () => {
    const result = pick({ en: "Tee", es: "Remera", pt: "Camiseta" }, "pt");

    expect(result).toBe("Camiseta");
  });
});
