import { describe, expect, it } from "vitest";
import { PreviewFieldSchema, toPreviewIndex } from "../preview";

const field = {
  id: "preview", namespace: "custom", key: "preview", value_type: "boolean", owner_resource: "product", has_more: false,
  owners: [
    { entity_id: "101", value: true },
    { entity_id: "102", value: false },
    { entity_id: "bad", value: true },
    { entity_id: "103", value: "yes" },
    { entity_id: "104", value: { enabled: true } },
    { entity_id: "105", value: 1 },
  ],
};

describe("toPreviewIndex", () => {
  it("marks only owners whose value is a bare boolean true", () => {
    const result = toPreviewIndex(PreviewFieldSchema.parse(field));
    expect(result.values.get(101)).toBe(true);
    expect(result.values.get(102)).toBe(false);
  });

  it("treats malformed owners as off and reports them, never throwing", () => {
    const result = toPreviewIndex(PreviewFieldSchema.parse(field));
    for (const id of [103, 104, 105]) expect(result.values.get(id) ?? false).toBe(false);
    expect(result.diagnostics).toHaveLength(4);
  });
});
