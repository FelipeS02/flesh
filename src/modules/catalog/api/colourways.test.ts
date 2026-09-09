import { describe, expect, it } from "vitest";
import { ColourwayFieldSchema, toColourwayIndex } from "./colourways";

describe("Colourway owner contract", () => {
  it("accepts color_name and maps it to the display name", () => {
    const field = ColourwayFieldSchema.parse({ id: "c", namespace: "custom", key: "colourway", value_type: "object", owner_resource: "product", has_more: false, owners: [{ entity_id: "1", value: { group: "tee", hex: "#000", color_name: "Noir" } }] });
    expect(toColourwayIndex(field).values.get(1)).toEqual({ group: "tee", hex: "#000", name: "Noir" });
  });

  it("rejects the legacy colorname key", () => {
    expect(() => ColourwayFieldSchema.parse({ id: "c", namespace: "custom", key: "colourway", value_type: "object", owner_resource: "product", has_more: false, owners: [{ entity_id: "1", value: { group: "tee", hex: "#000", colorname: "Noir" } }] })).toThrow();
  });

  it("isolates owners whose entity id is not a safe positive integer", () => {
    const field = ColourwayFieldSchema.parse({
      id: "c", namespace: "custom", key: "colourway", value_type: "object", owner_resource: "product", has_more: false,
      owners: [
        { entity_id: "1.5", value: { group: "tee", hex: "#000", color_name: "Fraction" } },
        { entity_id: "-1", value: { group: "tee", hex: "#000", color_name: "Negative" } },
        { entity_id: "9007199254740992", value: { group: "tee", hex: "#000", color_name: "Unsafe" } },
        { entity_id: "2", value: { group: "tee", hex: "#fff", color_name: "White" } },
      ],
    });

    const result = toColourwayIndex(field);
    expect([...result.values.keys()]).toEqual([2]);
    expect(result.diagnostics).toHaveLength(3);
  });
});
