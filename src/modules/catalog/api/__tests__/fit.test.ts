import { describe, expect, it } from "vitest";
import { FitFieldSchema, toFitIndex } from "../fit";

const field = {
  id: "fit", namespace: "custom", key: "fit", value_type: "object", owner_resource: "product", has_more: false,
  owners: [
    { entity_id: "101", value: { type: "top", position: 65 } },
    { entity_id: "102", value: { type: "bottom", position: 100 } },
    { entity_id: "bad", value: { type: "top", position: 20 } },
    { entity_id: "103", value: { type: "unknown", position: 20 } },
    { entity_id: "104", value: { type: "top", position: 101 } },
  ],
};

describe("toFitIndex", () => {
  it("indexes bounded top and bottom fits by numeric product id", () => {
    const result = toFitIndex(FitFieldSchema.parse(field));
    expect(result.values.get(101)).toEqual({ type: "top", position: 65 });
    expect(result.values.get(102)).toEqual({ type: "bottom", position: 100 });
  });

  it("isolates malformed owners without dropping valid owners", () => {
    const result = toFitIndex(FitFieldSchema.parse(field));
    expect(result.values.has(103)).toBe(false);
    expect(result.values.has(104)).toBe(false);
    expect(result.diagnostics).toHaveLength(3);
  });
});
