import { describe, expect, it } from "vitest";
import * as clientSurface from "./client";

// A guard the type system cannot give us. `source.ts` carries `import
// "server-only"`, so ANY client component reaching it — even transitively
// through the module's barrel — fails the production build. Vitest aliases
// `server-only` to a no-op stub (task 1.2), which is what makes that failure
// invisible to every other test in this suite: it only ever showed up in
// `next dev`.
//
// This is the cheap structural stand-in: the client entry may expose the pure
// domain and nothing that can reach the data source.

describe("catalog client entry", () => {
  it("exposes the pure domain a client component needs", () => {
    expect(typeof clientSurface.deriveAxisStates).toBe("function");
    expect(typeof clientSurface.resolveVariant).toBe("function");
    expect(typeof clientSurface.formatMoney).toBe("function");
  });

  it("re-exports nothing that reads the catalogue", () => {
    const surface = Object.keys(clientSurface);

    expect(surface).not.toContain("getProducts");
    expect(surface).not.toContain("getProductByHandle");
    expect(surface).not.toContain("source");
  });
});
