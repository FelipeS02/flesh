import type { ColourwayField } from "../colourways";

// The response of `GET /products/custom-fields/{field_id}/owners`, shaped
// verbatim as the live store returns it — a separate resource from the
// product, so a separate fixture. Swapping this for a real fetch is the whole
// of the integration: the join in `./source.ts` does not change.
//
// Faithful details that are easy to get wrong and are therefore kept here:
// - `entity_id` is a STRING; `product.id` is a NUMBER.
// - keys are lowercase (`colorname`), because Tiendanube lowercases whatever
//   the merchant typed in the field's schema.
// - the owner list carries an id the catalogue does NOT contain (`999`).
//   That is not a mistake in this fixture. The live store returned four
//   owners for a two-product catalogue: deleted products keep their
//   custom-field values forever. The join must survive it.
export const colourwayField = {
  id: "4dda0ec16565dbb89973c166689f4ce8",
  namespace: "custom",
  key: "colourway",
  value_type: "object[]",
  owner_resource: "product",
  owners: [
    {
      entity_id: "108",
      value: [{ hex: "#0A0A0A", colorname: "Noir", group: "remera-cruz" }],
    },
    {
      entity_id: "109",
      value: [{ hex: "#E8E4DA", colorname: "Hueso", group: "remera-cruz" }],
    },
    {
      // A product that no longer exists. `GET /products/999` is a 404.
      entity_id: "999",
      value: [{ hex: "#7A1F1F", colorname: "Blood", group: "remera-cruz" }],
    },
  ],
  has_more: false,
} satisfies ColourwayField;
