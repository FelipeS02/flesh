'use client';

import { Button } from '@/components/ui/button';
import type { CartLine } from '../domain/line';
import { useCartDispatch } from '../state/cart-context';
import { X } from 'lucide-react';

type RemoveLineButtonProps = {
  line: CartLine;
};

/**
 * The explicit remove for one line, distinct from decrementing to zero: it
 * drops the line at ANY quantity, not only at 1 (spec: "Explicit remove and
 * clear").
 *
 * Its own component rather than part of `Stepper`, which is where it used to
 * live. The `Cart Items / Promocion` artboard puts it on the title row beside
 * the garment's name while the stepper sits on the bottom row beside the
 * price — one box cannot be in two rows, and a `Stepper` that renders an
 * action belonging to a different row is a component lying about its scope.
 *
 * Coloured `destructive` per that artboard. It is the one control in the
 * drawer that discards something, and the row gives it no other signal — no
 * icon, no confirmation — so the colour is carrying that weight alone.
 */
export function RemoveLineButton({ line }: RemoveLineButtonProps) {
  const dispatch = useCartDispatch();

  return (
    <Button
      variant='ghost'
      size='xs'
      onClick={() => dispatch({ type: 'remove', variantId: line.variantId })}
      aria-label='Eliminar producto del carrito'
      className='h-4 shrink-0 px-0 font-sans hover:bg-transparent text-muted-foreground'
    >
      <X />
    </Button>
  );
}
