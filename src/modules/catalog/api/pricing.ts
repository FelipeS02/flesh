// Store settings arrive through the same admin API, same token, same rate
// limit as products — see `port.ts`'s reference doc. `import "server-only"`
// establishes that boundary now, on the local stand-in, before a live fetch
// layer exists, mirroring `source.ts` (task 4a.14).
import "server-only";
import { TRANSFER_RATE_BP } from "../lib/pricing";

/**
 * The rate is NEVER a module constant read at call sites (binding answer 1:
 * 10% is fixed brand policy today, but it lives as a Tiendanube store
 * setting). Basis points, not a float — see `lib/pricing.ts`'s module
 * comment for why.
 */
export interface PricingPolicy {
  transferRateBp: number;
}

// Typed over the same Promise-or-value shape as `CatalogPort` (see
// `port.ts`) so a future Tiendanube-backed implementation is a drop-in
// replacement without touching any caller.
export interface PricingPolicyPort {
  getPricingPolicy(): Promise<PricingPolicy> | PricingPolicy;
}

function getPricingPolicy(): PricingPolicy {
  // Reads the shared constant rather than restating 1000. Two literals is how
  // the float and the basis-point rate came to disagree in the first place.
  return { transferRateBp: TRANSFER_RATE_BP };
}

export { getPricingPolicy };
export const pricingSource = {
  getPricingPolicy,
} satisfies PricingPolicyPort;
