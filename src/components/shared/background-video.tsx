'use client';

import { useEffect, useState } from 'react';

const BACKGROUND_SRC = '/background.webm';

/**
 * The plate's `<video>`, which does not fetch a byte until the document has
 * finished loading.
 *
 * This is the whole reason the plate needs a client boundary at all, and it is
 * a measurement, not a preference. An autoplaying `<video>` is an LCP
 * candidate: Chrome takes its first painted frame as the largest contentful
 * paint and reports the moment that frame arrives. With the source declared in
 * the markup, the browser began the download alongside the page, and on a
 * throttled mobile connection Lighthouse reported an LCP of 11.0s against a
 * document that was visually complete at 1.3s. The page was never slow — the
 * decorative background was simply being measured as if it were the content.
 *
 * Withholding `src` until `load` moves that download off the critical path
 * entirely. The poster — frame 0 of this same video — becomes the largest
 * paint instead, at a fraction of the bytes, and the video takes over once
 * nothing is waiting on it. Nobody judges a background loop in the first
 * second; they read the page over it.
 *
 * `src` rather than a `<source>` child: swapping `<source>` elements does
 * nothing until `video.load()` is called by hand, whereas the attribute is
 * declarative and React can simply set it.
 *
 * The reduced-motion check is NOT a duplicate of `motion-reduce:hidden` on the
 * element. That class stops the video being PAINTED; a browser still downloads
 * the source of a `display: none` video in full. Declining to set `src` is the
 * only thing that actually spares those viewers the megabyte.
 */
export function BackgroundVideo() {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const start = () => setSrc(BACKGROUND_SRC);

    // `load` fires once per document and never again. A plate mounted after it
    // — every client-side remount, and every mount under Fast Refresh — would
    // wait for an event that is not coming and sit on its poster forever.
    if (document.readyState === 'complete') {
      start();
      return;
    }

    window.addEventListener('load', start, { once: true });

    return () => window.removeEventListener('load', start);
  }, []);

  return (
    <video
      className='h-full w-full object-cover motion-reduce:hidden'
      src={src}
      poster='/background-poster.webp'
      autoPlay
      muted
      loop
      playsInline
      tabIndex={-1}
    />
  );
}
