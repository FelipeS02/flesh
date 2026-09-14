import { cn } from '@/lib/utils';

type BarbedWireSeparatorProps = {
  className?: string;
};

/**
 * The tile count is the viewport's business, not ours: no amount of markup can
 * know how many 97px strands fit before layout runs. `repeat-x` is the browser
 * answering that question for free, on every resize, with a single node.
 *
 * It has to be a mask rather than a `background-image` because an external SVG
 * gets no `currentColor` context — the file paints an opaque silhouette and
 * `bg-current` supplies the actual ink, so the separator still inherits its
 * color from whatever section it sits in.
 */
const BarbedWireSeparator = ({ className }: BarbedWireSeparatorProps) => {
  return (
    <div
      role='separator'
      aria-orientation='horizontal'
      className={cn(
        'h-4 bg-foreground/80 w-full',
        '[mask-image:url(/barbed-wire.svg)] [mask-repeat:repeat-x][mask-position:center] [mask-size:auto_100%]',
        className,
      )}
    />
  );
};

export default BarbedWireSeparator;
