import type { VariantView } from "@/modules/catalog/client";

// `CartLineId` is the variant id, not a synthetic key: a variant's line is
// either removed or repriced, never both, so no linking key beyond the id
// the real store already assigns is ever needed. Same reasoning the
// storefront design used to reject a synthetic axis/value key (see
// `sdd/flesh-cart/design` D5) — and it is the id a real Tiendanube order
// would reference.
export type CartLineId = VariantView["id"];
