import { describe, expect, it } from "vitest";
import { getPricingPolicy } from "./pricing";

// `getPricingPolicy` mirrors `source.ts`'s shape: a local, synchronous stand-in
// for what will eventually be a Tiendanube store-settings fetch. Store
// settings arrive through the same admin API, same token, same rate limit as
// products (see `port.ts`) — hence the same port-shaped seam, not a bare
// exported constant.

describe("getPricingPolicy", () => {
  it("returns today's fixed transfer rate as basis points, not a float", () => {
    const result = getPricingPolicy();

    expect(result).toEqual({ transferRateBp: 1000 });
  });

  it("returns an integer basis-points value", () => {
    const result = getPricingPolicy();

    expect(Number.isInteger(result.transferRateBp)).toBe(true);
  });
});
