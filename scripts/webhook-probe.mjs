#!/usr/bin/env node
// Setup tool for Tiendanube webhook subscriptions. Not part of the app: a
// subscription lives in Tiendanube, not in this repo, so it is registered once
// per environment and survives every deploy.
//
// Reads credentials from .env.local directly so no secret is ever pasted into a
// shell, a transcript, or a command history.
//
//   node scripts/webhook-probe.mjs list
//   node scripts/webhook-probe.mjs register product/updated https://<host>/api/webhooks/tiendanube
//   node scripts/webhook-probe.mjs delete <webhook-id>     <- numeric id, NOT the URL
//   node scripts/webhook-probe.mjs nuke                    <- delete every webhook.site subscription
//   node scripts/webhook-probe.mjs nuke --all              <- delete EVERY webhook, no filter

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file lives in <repo>/scripts, so the repo root is one level up. An
// absolute path baked in here would only ever work on one machine.
const REPO = process.env.FLESH_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_ORIGIN = "https://api.tiendanube.com";
const PROBE_HOST = "webhook.site";

// A missing file is not fatal on its own: the variables may already be exported
// in the shell. Only the absence of the VALUES is an error, reported below.
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

function readConfig() {
  const envPath = resolve(REPO, ".env.local");
  const env = { ...loadEnvFile(envPath), ...process.env };
  const storeId = env.TIENDANUBE_STORE_ID;
  const accessToken = env.TIENDANUBE_ACCESS_TOKEN;
  const userAgent = env.TIENDANUBE_USER_AGENT;
  const missing = Object.entries({
    TIENDANUBE_STORE_ID: storeId,
    TIENDANUBE_ACCESS_TOKEN: accessToken,
    TIENDANUBE_USER_AGENT: userAgent,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")} — not found in ${envPath} nor in the environment.`);
  }
  return { storeId, accessToken, userAgent };
}

async function call(config, method, path, body) {
  const url = new URL(`/v1/${config.storeId}${path}`, API_ORIGIN);
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.accessToken}`,
      "user-agent": config.userAgent,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  // Surfaced verbatim: a missing scope or a wrong path must be diagnosable on
  // the first run rather than guessed at.
  if (!response.ok) throw new Error(`${method} ${url.pathname} -> ${response.status}\n${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const listWebhooks = (config) => call(config, "GET", "/webhooks").then((hooks) => hooks ?? []);

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = readConfig();

  if (command === "list") {
    const hooks = await listWebhooks(config);
    if (hooks.length === 0) return console.log("No webhooks registered.");
    console.log("id\tevent\turl");
    for (const hook of hooks) console.log(`${hook.id}\t${hook.event}\t${hook.url}`);
    return;
  }

  if (command === "register") {
    const [event, url] = args;
    if (!event || !url) throw new Error("Usage: register <event> <https url>");
    const hook = await call(config, "POST", "/webhooks", { event, url });
    console.log(`Registered ${hook.event} -> ${hook.url}\nid: ${hook.id}`);
    return;
  }

  if (command === "delete") {
    const [id] = args;
    // The id is a number. Passing the registered URL here builds a nonsense
    // path, and the API answers 404, which reads like a broken tool.
    if (!/^\d+$/.test(id ?? "")) {
      throw new Error(`delete expects the numeric webhook id, not "${id ?? ""}". Run "list" to see the ids, or "nuke" to remove every ${PROBE_HOST} subscription.`);
    }
    await call(config, "DELETE", `/webhooks/${id}`);
    console.log(`Deleted webhook ${id}.`);
    return;
  }

  if (command === "nuke") {
    const all = args.includes("--all");
    const hooks = await listWebhooks(config);
    // Probe subscriptions only by default: a blind delete-everything would also
    // remove production webhooks that were never part of an experiment.
    const doomed = all ? hooks : hooks.filter((hook) => String(hook.url).includes(PROBE_HOST));
    if (doomed.length === 0) {
      console.log(all ? "No webhooks registered." : `No ${PROBE_HOST} subscriptions found.`);
      if (!all && hooks.length > 0) console.log(`${hooks.length} other webhook(s) left untouched. Use --all to delete those too.`);
      return;
    }
    console.log(`Deleting ${doomed.length} webhook(s):`);
    for (const hook of doomed) {
      await call(config, "DELETE", `/webhooks/${hook.id}`);
      console.log(`  deleted ${hook.id}  ${hook.event}  ${hook.url}`);
    }
    const spared = hooks.length - doomed.length;
    if (spared > 0) console.log(`${spared} non-${PROBE_HOST} webhook(s) left untouched. Use --all to delete those too.`);
    return;
  }

  console.log("Commands:\n  list\n  register <event> <url>\n  delete <numeric id>\n  nuke [--all]");
  process.exitCode = 1;
}

// Report failures as one clean line: a stack trace here says nothing useful and
// buries the API response that does.
main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
