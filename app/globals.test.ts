import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Read relative to this file, not to the repo root: PR5a moves `app/` into
// `src/app/`, and this suite should survive that move untouched.
const rawCss = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

// Assert against the RULES, not the prose. The file deliberately explains in
// a comment why the `dark:` variant stays class-bound, and that explanation
// has to name the media feature it is protecting against — a check over the
// raw text would fire on the documentation instead of on the CSS.
const globalsCss = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");

describe("globals.css — single theme", () => {
  it("carries no prefers-color-scheme block", () => {
    // The site is black in every state. A media query that retunes tokens by
    // OS preference is not a leftover to tidy up later — it silently produces
    // a second theme nobody designed.
    expect(globalsCss).not.toContain("prefers-color-scheme");
  });

  it("carries no .dark class block", () => {
    // shadcn init emits `:root` + `.dark`. Deleting only the media query
    // leaves this second token set behind, which is the easy half to miss.
    expect(globalsCss).not.toMatch(/^\.dark\s*\{/m);
  });

  it("does not override the type system with a hardcoded body font-family", () => {
    expect(globalsCss).not.toContain("Arial");
  });
});

describe("globals.css — display font stack", () => {
  it("declares --font-display as a stack, not a single family", () => {
    // Kraut covers only U+0020-007E (measured, see the comment in
    // layout.tsx). Every accented character in the Spanish UI copy falls
    // OUT of range, so a single-family token would send á é í ó ú ñ ¿ ¡ to
    // whatever default the browser happens to pick.
    const match = globalsCss.match(/--font-display:\s*([^;]+);/);

    expect(match).not.toBeNull();
    expect(match![1]).toContain(",");
  });
});
