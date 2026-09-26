'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { GarmentSize } from '@/modules/catalog/client';
import { SizeTable } from '../accordions/size-table';

// Matches the gallery's own breakpoint (`product-gallery.tsx`): both decide a
// layout CSS alone cannot express — there the carousel's scroll axis, here
// which of two entirely different components (Dialog vs Sheet) to mount.
const DESKTOP_QUERY = '(min-width: 768px)';

type SizeGuideProps = {
  sizeChart: readonly GarmentSize[];
  /** The shopper's current pick on the size axis; highlights that column in the table. */
  highlightSize?: string | null;
  /** The widget's cramped variant: "Guía" instead of "Guía de talles" + icon. */
  compact?: boolean;
};

/**
 * The size table, one tap away from the size choice.
 *
 * Lives beside `AxisSelector` rather than under `accordions/` (where
 * `SizeTable` itself lives): this component's only job is to be a trigger
 * INSIDE the axis selector's own label row, in both the panel and the
 * widget — `SizeTable` is the reusable presentation piece both this and
 * accordion 02 render, colocating with THAT consumer instead would put a
 * purchase-surface concern one folder away from where it is wired in.
 *
 * `Dialog` on desktop, `Sheet` on mobile — the callers never see the split;
 * `AxisSelector` renders one `<SizeGuide>` and gets whichever container the
 * viewport calls for.
 */
export function SizeGuide({
  sizeChart,
  highlightSize,
  compact,
}: SizeGuideProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const trigger = (
    <Button
      variant='link'
      className={cn(
        'h-auto gap-1 px-0 font-sans tracking-control',
        compact
          ? // Visually 9px to match the artboard's widget copy, but a naked
            // 9px tap target sits well under the 44px floor every other
            // control on this page respects. `before:` grows the HIT AREA
            // without touching the visible box — centred on the trigger
            // regardless of its own (much smaller) height, and safe to let
            // spill into the row above/below because nothing there is
            // itself interactive.
            "relative text-[9px] before:absolute before:-inset-x-1.5 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
          : 'text-[11px] md:text-[13px]',
      )}
    >
      {compact ? (
        'Guía'
      ) : (
        <>
          Guía de talles
          <ArrowRight aria-hidden className='size-3' />
        </>
      )}
    </Button>
  );

  // `SizeTable` prints "Medidas en centímetros" as its own footer; the modal
  // already says that as its description, immediately above the table, so
  // `hideCaption` is what keeps the sentence from appearing twice on the
  // same screen.
  const table = (
    <SizeTable
      sizeChart={sizeChart}
      highlightSize={highlightSize ?? undefined}
      hideCaption
    />
  );

  if (isDesktop) {
    return (
      <Dialog>
        <DialogTrigger render={trigger} />
        <DialogContent styledBackground className='sm:max-w-140'>
          <DialogHeader>
            <DialogTitle>Guía de talles</DialogTitle>
            <DialogDescription>Medidas en centímetros</DialogDescription>
          </DialogHeader>
          {table}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent styledBackground side='bottom' className="gap-0">
        <SheetHeader>
          <SheetTitle>
            Guía de talles
          </SheetTitle>
          <SheetDescription>
            Medidas en centímetros
          </SheetDescription>
        </SheetHeader>
        <div className='px-4 pb-4'>{table}</div>
      </SheetContent>
    </Sheet>
  );
}
