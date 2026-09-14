import Link from 'next/link';
import SkullSwatch from '@/components/shared/skull-swatch';
import SkullSwatchMarker from '@/components/shared/skull-swatch-marker';
import { cn } from '@/lib/utils';
import type { ColourwayLink } from '@/modules/catalog/client';

type ColourwaySwatchesProps = {
  links: ColourwayLink[];
  currentSlug: string;
  /** The widget's cramped variant: smaller dots, tighter hit areas. */
  compact?: boolean;
};

/**
 * The row of colours, as links.
 *
 * Shared by the panel's `ColourwaySelector` and the fixed purchase widget.
 * It carries no client state of its own — picking a colour is a NAVIGATION,
 * not a selection — which is what lets the same component sit inside a server
 * component and a client one without either paying for the other.
 */
export function ColourwaySwatches({
  links,
  currentSlug,
  compact,
}: ColourwaySwatchesProps) {
  const hit = compact ? 'size-9' : 'size-11';
  const dot = compact ? 'size-7' : 'size-9';

  return (
    <ul
      aria-label='Colores'
      className={cn('flex items-center -ml-1', compact ? 'gap-1.5' : 'gap-2.5')}
    >
      {links.map((link) => (
        <li key={link.slug}>
          {link.slug === currentSlug ? (
            <span
              aria-current='true'
              className={cn(
                'flex items-center justify-center rounded-full',
                hit,
              )}
            >
              <Swatch link={link} className={dot} selected />
              <span className='sr-only'>{link.name}</span>
            </span>
          ) : (
            <Link
              href={`/producto/${link.slug}`}
              className={cn(
                'flex items-center justify-center rounded-full',
                hit,
                // A sold-out colour stays reachable on purpose: its page
                // carries the photographs and the sizes, and telling someone
                // they cannot even LOOK at it is a harsher answer than the
                // page itself gives.
                !link.inStock && 'opacity-40',
              )}
            >
              <Swatch link={link} className={dot} />
              <span className='sr-only'>
                {link.inStock ? link.name : `${link.name} — agotado`}
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The dot itself, inside a 44px hit area (`size-11` on the row above): the
 * ring needs somewhere to sit, and the gap between the two is what keeps the
 * tappable square at the touch-target floor while the visible swatch stays
 * the size the artboard drew.
 */
function Swatch({
  link,
  className,
  selected = false,
}: {
  link: ColourwayLink;
  className: string;
  selected?: boolean;
}) {
  return (
    <span data-swatch className={cn('relative block', className)}>
      <SkullSwatch
        aria-hidden='true'
        className='size-full'
        style={{ color: link.hex }}
      />

      <SkullSwatchMarker
        data-selected={selected}
        aria-hidden='true'
        className='absolute -inset-y-1 -inset-x-0.75 size-[120%] not-data-selected:opacity-0 not-data-selected:hover:opacity-40 text-foreground'
      />

      {!link.inStock && (
        <svg
          viewBox='0 0 12 12'
          aria-hidden='true'
          className='absolute inset-0 size-full text-muted-foreground'
        >
          <line
            x1='1.5'
            y1='10.5'
            x2='10.5'
            y2='1.5'
            stroke='currentColor'
            strokeWidth='1'
            strokeLinecap='round'
          />
        </svg>
      )}
    </span>
  );
}
