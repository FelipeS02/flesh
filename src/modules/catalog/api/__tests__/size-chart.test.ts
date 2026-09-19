import { describe, expect, it } from "vitest";
import { SizeChartFieldSchema, toSizeChartIndex } from "../size-chart";

describe("toSizeChartIndex", () => {
  it("keeps valid sparse positive centimetre rows and rejects invalid rows independently", () => {
    const field = SizeChartFieldSchema.parse({
      id: "chart", namespace: "custom", key: "size_chart", value_type: "object[]", owner_resource: "product", has_more: false,
      owners: [
        { entity_id: "101", value: [{ size: "M", chest_width: 52 }, { size: "L", chest_width: 56, sleeve_length: 20 }] },
        { entity_id: "102", value: [{ size: "M", chest_width: 0 }] },
      ],
    });
    const result = toSizeChartIndex(field);
    expect(result.values.get(101)).toEqual([
      { size: "M", measurements: { chest_width: 52 } },
      { size: "L", measurements: { chest_width: 56, sleeve_length: 20 } },
    ]);
    expect(result.values.has(102)).toBe(false);
  });
});
