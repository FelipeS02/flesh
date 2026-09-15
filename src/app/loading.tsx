import Image from 'next/image';

/**
 * Next.js renders this component inside the nearest `<Suspense>` while a route
 * segment is streaming. Placed at the app root it covers every route that does
 * not define its own `loading.tsx`.
 *
 * The skull illustration pulses with a slow fade-in / fade-out loop so the
 * screen feels alive rather than frozen. `will-change: opacity` promotes it to
 * its own compositor layer — the animation runs entirely on the GPU and never
 * touches the main thread, which matters while the page's JS is still loading.
 */
export default function GlobalLoading() {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-background'>
      <Image
        src='/password-illustration.webp'
        alt=''
        width={600}
        height={600}
        priority
        className='animate-in fade-in-0 direction-alternate repeat-infinite animation-duration-600 will-change-[opacity] max-md:max-w-[80%]'
      />
    </div>
  );
}
