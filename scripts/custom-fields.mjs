#!/usr/bin/env node
// Editor for the product custom fields the catalog loader reads (`colourway`,
// `fit`, `size_chart`). Not part of the app: the Tiendanube admin does not show
// these fields on the product page, so the API is the only way to write them.
//
// Reads credentials from an env file directly so no secret is ever pasted into
// a shell, a transcript, or a command history. Defaults to .env.production,
// because production is the store whose values the live site renders.
//
//   node scripts/custom-fields.mjs list
//   node scripts/custom-fields.mjs show <product-id>
//   node scripts/custom-fields.mjs set <product-id> <colourway|fit|size_chart> '<json value>'
//   node scripts/custom-fields.mjs list --env .env.local
//
// The endpoints are `/unstable/` and undocumented; the routes below were found
// by probing. If a call starts returning 404, the API moved — do not guess new
// routes against production data.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file lives in <repo>/scripts, so the repo root is one level up. An
// absolute path baked in here would only ever work on one machine.
const REPO = process.env.FLESH_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_ORIGIN = "https://api.tiendanube.com";
const SLUGS = ["colourway", "fit", "size_chart"];

// Mirrors src/modules/catalog/domain/garment.ts. A key the loader does not know
// would be stored and then silently dropped when the page renders.
const MEASUREMENT_KEYS = [
  "back_width",
  "chest_width",
  "waist_width",
  "garment_length",
  "sleeve_length",
  "front_rise",
  "leg_opening",
];

function loadEnvFile(path) {
  const values = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return values;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    values[key] = rest.trim().replace(/^(['"])(.*)\1$/s, "$2");
  }
  return values;
}

const args = process.argv.slice(2);
const envFlag = args.indexOf("--env");
const envFile = envFlag === -1 ? ".env.production" : args.splice(envFlag, 2)[1];
const env = { ...process.env, ...loadEnvFile(resolve(REPO, envFile)) };
const { TIENDANUBE_STORE_ID: storeId, TIENDANUBE_ACCESS_TOKEN: token, TIENDANUBE_USER_AGENT: userAgent } = env;
if (!storeId || !token || !userAgent) {
  fail(`Missing TIENDANUBE_STORE_ID, TIENDANUBE_ACCESS_TOKEN or TIENDANUBE_USER_AGENT in ${envFile}.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function request(method, path, body) {
  const response = await fetch(`${API_ORIGIN}/${path}`, {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": userAgent,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) fail(`${method} ${path.replace(storeId, "{store}")} -> ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function loadProducts() {
  const products = [];
  for (let page = 1; ; page += 1) {
    const batch = await request("GET", `2025-03/${storeId}/products?per_page=200&page=${page}&fields=id,name,handle,visibility`);
    products.push(...batch);
    if (batch.length < 200) return products;
  }
}

// One owners call per field instead of one call per product.
async function loadValues() {
  const values = new Map();
  for (const slug of SLUGS) {
    let cursor;
    do {
      const query = `limit=200${cursor ? `&after=${cursor}` : ""}`;
      const page = await request("GET", `unstable/${storeId}/products/custom-fields/custom/${slug}/owners?${query}`);
      for (const owner of page.owners) {
        const entry = values.get(owner.entity_id) ?? {};
        entry[slug] = owner.value;
        values.set(owner.entity_id, entry);
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
  }
  return values;
}

const localized = (value) => (typeof value === "string" ? value : value?.es ?? Object.values(value ?? {})[0] ?? "");

function validate(slug, value) {
  const isObject = (candidate) => candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);
  const positiveInt = (candidate) => Number.isInteger(candidate) && candidate > 0;
  if (slug === "fit") {
    if (!isObject(value) || !["top", "bottom"].includes(value.type)) return "fit.type must be \"top\" or \"bottom\".";
    if (!Number.isInteger(value.position) || value.position < 0 || value.position > 100) return "fit.position must be an integer 0-100.";
    return null;
  }
  if (slug === "colourway") {
    if (!isObject(value)) return "colourway must be an object.";
    if (!/^#[0-9A-Fa-f]{6}$/.test(value.hex ?? "")) return "colourway.hex must look like #D10101.";
    if (!value.color_name?.trim() || !value.group?.trim()) return "colourway needs a non-empty color_name and group.";
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) return "size_chart must be a non-empty array of rows.";
  for (const row of value) {
    if (!isObject(row) || !row.size?.trim()) return "every size_chart row needs a non-empty size.";
    for (const [key, measure] of Object.entries(row)) {
      if (key === "size") continue;
      if (!MEASUREMENT_KEYS.includes(key)) return `unknown measurement "${key}"; valid: ${MEASUREMENT_KEYS.join(", ")}.`;
      if (!positiveInt(measure)) return `${row.size}.${key} must be a positive integer.`;
    }
  }
  return null;
}

const [command, productId, slug, rawValue] = args;

if (command === "list") {
  const [products, values] = await Promise.all([loadProducts(), loadValues()]);
  console.log(JSON.stringify(products.map((product) => ({
    id: product.id,
    name: localized(product.name),
    handle: localized(product.handle),
    visibility: product.visibility,
    fields: values.get(String(product.id)) ?? {},
  })), null, 2));
} else if (command === "show") {
  if (!productId) fail("Usage: show <product-id>");
  const values = await loadValues();
  console.log(JSON.stringify(values.get(productId) ?? {}, null, 2));
} else if (command === "set") {
  if (!productId || !SLUGS.includes(slug) || rawValue === undefined) fail("Usage: set <product-id> <colourway|fit|size_chart> '<json value>'");
  let value;
  try {
    value = JSON.parse(rawValue);
  } catch {
    fail("The value is not valid JSON.");
  }
  const problem = validate(slug, value);
  if (problem) fail(`Refused: ${problem}`);
  const saved = await request("PUT", `unstable/${storeId}/products/${productId}/custom-fields/custom/${slug}/value`, { value });
  console.log(JSON.stringify(saved.value, null, 2));
} else {
  fail("Commands: list | show <product-id> | set <product-id> <slug> '<json>'  [--env <file>]");
}
