import type { FitField } from "../fit";
import type { SizeChartField } from "../size-chart";

export const fitField = {
  id: "fit", namespace: "custom", key: "fit", value_type: "object", owner_resource: "product", has_more: false,
  owners: [
    { entity_id: "101", value: { type: "top", position: 65 } },
    { entity_id: "104", value: { type: "top", position: 70 } },
    { entity_id: "105", value: { type: "top", position: 55 } },
    { entity_id: "106", value: { type: "bottom", position: 75 } },
    { entity_id: "108", value: { type: "top", position: 60 } },
    { entity_id: "109", value: { type: "top", position: 60 } },
    { entity_id: "999", value: { type: "top", position: 40 } },
  ],
} satisfies FitField;

export const sizeChartField = {
  id: "size-chart", namespace: "custom", key: "size_chart", value_type: "object[]", owner_resource: "product", has_more: false,
  owners: [
    { entity_id: "101", value: [{ size: "S", chest_width: 50, garment_length: 63 }, { size: "M", chest_width: 54, garment_length: 68, sleeve_length: 20 }] },
    { entity_id: "104", value: [{ size: "M", chest_width: 54, garment_length: 68 }, { size: "L", chest_width: 58, garment_length: 72 }, { size: "XL", chest_width: 62, garment_length: 76 }] },
    { entity_id: "105", value: [{ size: "M", chest_width: 54 }] },
    { entity_id: "106", value: [{ size: "M", chest_width: 55, waist_width: 52 }, { size: "L", chest_width: 59, waist_width: 56 }] },
    { entity_id: "108", value: [{ size: "M", chest_width: 54 }, { size: "L", chest_width: 58 }] },
    { entity_id: "109", value: [{ size: "M", chest_width: 54 }] },
    { entity_id: "999", value: [{ size: "M", chest_width: 44 }] },
  ],
} satisfies SizeChartField;
