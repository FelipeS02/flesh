---
name: product-fields
description: "Trigger: product fields, custom fields, colourway, fit, size chart, tabla de talles, campos personalizados. Edit Tiendanube product custom fields interactively."
license: Apache-2.0
metadata:
  author: "FelipeS02"
  version: "1.0"
---

## Activation Contract

Use when the user wants to view or change a product's `colourway`, `fit` or `size_chart`. The Tiendanube admin cannot edit these; `scripts/custom-fields.mjs` is the only writer.

## Hard Rules

- Run only `node scripts/custom-fields.mjs`. Never read, print or ask for `.env.*` values; the script loads them itself.
- Default store is production (`.env.production`). Pass `--env .env.local` only when the user names the dev store.
- Write only after the user confirms the exact value shown. One confirmation covers one batch.
- Never guess new API routes. If the script reports 404, stop and report it.
- Copy shopper-facing text (`color_name`, `size`) exactly as the user types it; point out when casing differs from sibling products.

## Decision Gates

| Field | Value shape |
|---|---|
| `fit` | `{"type":"top"\|"bottom","position":0-100}` |
| `colourway` | `{"color_name":"…","hex":"#RRGGBB","group":"…"}`; siblings share `group` verbatim |
| `size_chart` | `[{"size":"M","chest_width":56,…}]`; keys: `back_width chest_width waist_width garment_length sleeve_length front_rise leg_opening`, positive integers, omit empty ones |

## Execution Steps

1. Run `list`. Present products with `AskUserQuestion`: label `NAME (handle)`, description = fields already set. If more than 4 products, print a numbered list and wait instead.
2. Show the chosen product's current values as a compact table, then ask in one question what to change. Accept plain language ("fit bottom 40", a pasted size table, a screenshot).
3. Build the JSON per field. For `size_chart`, send the full table; it replaces the previous one.
4. Show the final value(s) and ask for confirmation.
5. Run `set <id> <slug> '<json>'` per field. On `Refused:`, fix the input with the user; never bypass validation.
6. Run `show <id>` and report the saved values.

## Output Contract

Report the product, each field written with its saved value, and any refused or failed write verbatim.

## References

- `scripts/custom-fields.mjs` — commands, validation, endpoints.
- `src/modules/catalog/api/` — how the loader reads these fields (`colourways.ts`, `fit.ts`, `size-chart.ts`).
