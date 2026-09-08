"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import FleshLogotype from "@/components/shared/flesh-logotype";
import { CartDrawer, itemCount, useCartState } from "@/modules/cart";

/** The header owns the controlled cart drawer and its hydration-safe badge. */
export function Header() {
  const [cartOpen, setCartOpen] = useState(false);
  const state = useCartState();
  const count = state.status === "ready" ? itemCount(state.lines) : null;

  return (
    <>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center pt-7.5 md:pt-11">
        <Link
          href="/"
          aria-label="FLESH â€” inicio"
          className="col-start-2 justify-self-center"
        >
          <FleshLogotype className="w-28" />
        </Link>
        <button
          type="button"
          aria-label="Abrir carrito"
          onClick={() => setCartOpen(true)}
          className="relative col-start-3 justify-self-end text-foreground"
        >
          <ShoppingBag aria-hidden="true" className="size-5" />
          {count !== null && (
            <span
              aria-label={`${count} productos en el carrito`}
              className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-primary font-sans text-[9px] text-primary-foreground"
            >
              {count}
            </span>
          )}
        </button>
      </header>
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
