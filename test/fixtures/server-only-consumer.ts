// Test-only fixture (not production source). Carries a real
// `import "server-only"` so `test/harness/server-only-alias.test.ts` proves
// the `server-only` -> `test/server-only-stub.ts` alias in
// `vitest.config.mts` actually resolves. This is the mechanism a real
// server-side module (e.g. `catalog/api/source.ts` in PR4a) will depend on
// to keep the Tiendanube token off the browser while staying unit-testable.
import "server-only";

export function getMarker(scope: string): string {
  return `server-only:${scope}`;
}
