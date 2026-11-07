import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignTemplate } from "./messages";

/** Where a campaign lives; one disposable file per campaign. */
export function campaignFilePath(slug: string): string {
  // `resolve` rather than `new URL(..., import.meta.url)`: Vite rewrites that
  // pattern as an asset import and turns a dynamic slug into "undefined".
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "emails", "campaigns", `${slug}.tsx`);
}

/**
 * Checks the shape a dynamically imported file has to have. The import is
 * untyped, and a campaign missing its subject would otherwise go out as an
 * email with a blank one.
 */
export function readCampaignTemplate(slug: string, module: unknown): CampaignTemplate {
  const candidate = unwrapInterop(module) as Partial<Record<keyof CampaignTemplate, unknown>>;
  if (typeof candidate.default !== "function") {
    throw new Error(`Campaign "${slug}" must default-export its email component.`);
  }
  for (const key of ["subject", "previewText"] as const) {
    const value = candidate[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Campaign "${slug}" must export a non-empty ${key} string.`);
    }
  }
  return candidate as unknown as CampaignTemplate;
}

/**
 * tsx loads a `.tsx` file as CommonJS (the package is not `"type": "module"`),
 * so a dynamic `import()` hands back the real exports one level down, as
 * `default`. A component is a function, so an object `default` is that wrapper.
 */
function unwrapInterop(module: unknown): object {
  const outer = (module ?? {}) as { default?: unknown };
  return typeof outer.default === "object" && outer.default !== null ? outer.default : outer;
}
