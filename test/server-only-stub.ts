// No-op stub for the `server-only` package under Vitest.
//
// Next.js resolves `server-only` internally at build/runtime and throws if the
// module importing it is ever bundled into a client bundle. Outside of Next's
// own bundler (i.e. under Vitest/Node), there is no `node_modules/server-only`
// package installed, so the bare import would fail module resolution.
//
// `vitest.config.mts` aliases `server-only` to this file so that production
// modules can safely carry `import "server-only"` and remain unit-testable.
export {};
