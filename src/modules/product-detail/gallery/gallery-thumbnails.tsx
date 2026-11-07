import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ImageView, mediaSource } from '@/modules/catalog/client';

/** The rail renders at 64 CSS px, so the CDN's 240 derivative covers it at 2x. */
const THUMBNAIL_WIDTH = 64;

type GalleryThumbnailsProps = {
  /** Already in display order. */
  images: ImageView[];
  selected: number;
  onSelect: (index: number) => void;
  /** Layout of the list only; the thumbnails themselves are not restyled. */
  className?: string;
};

/**
 * The thumbnail rail shared by every gallery on the product page: the buy
 * gallery lays it out as a column beside the stage, the preview gallery as a
 * row under it. One markup, so a thumbnail looks and behaves the same in both.
 */
export function GalleryThumbnails({
  images,
  selected,
  onSelect,
  className,
}: GalleryThumbnailsProps) {
  return (
    <ul className={className}>
      {images.map((image, index) => {
        const active = index === selected;

        return (
          <li key={image.id}>
            <Button
              type='button'
              variant='ghost'
              aria-current={active ? 'true' : undefined}
              aria-pressed={active}
              aria-label={`Ver imagen ${index + 1} de ${images.length}`}
              onClick={() => onSelect(index)}
              className={cn(
                'relative block h-15.5 w-14 overflow-hidden rounded-none border border-transparent p-0 transition-[border-color,opacity] md:h-18 md:w-16',
                active ? 'border-foreground' : 'opacity-50',
              )}
            >
              {/* The opposite call to the stage: at 64 CSS px the CDN's 240
                  derivative already covers 2x, arrives as ~3 KB of WebP, and
                  costs us nothing to serve. Routing it through our optimizer
                  would re-encode an image that is already right. */}
              <Image
                {...mediaSource(image.src, { width: THUMBNAIL_WIDTH })}
                alt=''
                fill
                sizes='64px'
                className='object-contain'
              />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
