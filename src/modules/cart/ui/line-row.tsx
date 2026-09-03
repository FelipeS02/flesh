"use client";

import { useMemo } from "react";
import Image from "next/image";
import { formatMoney } from "@/modules/catalog/client";
import { indexCartCatalog } from "../domain/catalog-projection";
import type { CartLine } from "../domain/line";
import { useCartEnvironment } from "../state/cart-context";
import { Stepper } from "./stepper";

type LineRowProps = {
  line: CartLine;
};

/**
 * One line in the drawer — title, colour/size combination, and current
 * price, all three read from the live `CartCatalog` (design D1/D3), NEVER
 * from `line` itself. `CartLine` carries no title or combination at all:
 * only `productId` / `variantId` / `quantity` and a price WITNESS meant for
 * drift detection, never for display (see `domain/line.ts`'s own header
 * comment). Looking the variant up here — rather than accepting display data
 * as props — makes reading a stale or persisted copy a compile error, not a
 * discipline a future caller has to remember.
 */
export function LineRow({ line }: LineRowProps) {
  const { catalog } = useCartEnvironment();
  const index = useMemo(() => indexCartCatalog(catalog), [catalog]);
  const entry = index.get(line.variantId);

  // Not reachable through the product in normal operation: `reconcile`
  // removes a line the moment its variant is missing from the catalog,
  // before the provider ever holds it (design D4). Rendering nothing is the
  // honest answer if it somehow still happens.
  if (!entry) {
    return null;
  }

  const { product, variant } = entry;
  const combination = variant.combination.join(", ");

  return (
    <div className="flex items-start gap-4 border-b border-border py-4">
      {product.image && (
        // `alt=""`: the title beside it already names the garment, the same
        // rule `ProductCard`'s own image follows.
        <div className="relative size-20 shrink-0">
          <Image src={product.image} alt="" fill sizes="80px" className="object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-sans text-sm text-foreground">{product.title}</p>
        {combination && (
          <p className="font-sans text-xs text-muted-foreground">{combination}</p>
        )}
        <p className="font-sans text-sm tabular-nums text-foreground">
          {formatMoney(variant.price)}
        </p>
        <Stepper line={line} />
      </div>
    </div>
  );
}
