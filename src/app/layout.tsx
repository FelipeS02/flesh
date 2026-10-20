import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { BRAND, BRAND_LOCALE } from '@/lib/brand';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Both faces ship as WOFF2, converted from their TTF sources.
//
// `next/font/local` PRELOADS what it is given, so the format is not a
// packaging detail: TTF puts uncompressed font in the head, competing for
// bandwidth with the image the page is measured on — Special Elite alone is
// 152 KB as TTF and 62 KB as WOFF2. WOFF2 is a lossless container around the
// same outlines, which is why the charsets measured below still hold.

// Special Elite (Astigmatic, OFL), the body voice — a MODIFIED build. Served
// locally rather than from `next/font/google`, which would ship the upstream
// outlines and silently drop the edits.
//
// The WOFF2 is the only copy of those edits: the TTF it was converted from is
// not kept. Edit THIS file in FontForge (it opens WOFF2) and generate a WOFF2
// back over it — starting again from the upstream TTF would lose them.
//
// Measured from the WOFF2's cmap:
//
//   -> 20-7e a0-17e ...
//
// `a0-ff` covers á é í ó ú ñ ¿ ¡, so this face renders the whole Spanish copy
// on its own and needs no fallback family to patch accents.
//
// The previous face, `./fonts/copperplate-gothic-30ab.woff2`, is kept in the
// repo on purpose so it can be restored without re-converting the TTF.
const specialElite = localFont({
  src: './fonts/special-elite.woff2',
  variable: '--font-special-elite',
  display: 'swap',
});

// Kraut-type-a-fuck (Mr.Fisk, 2003), the display face — a MODIFIED build.
//
// Upstream Kraut ships printable ASCII plus two private-use glyphs and nothing
// else. The shipped file has the Spanish Latin-1 letters drawn in by hand
// (commit e3851c5), measured from the WOFF2's cmap:
//
//   -> 20-7e a1 bf-c1 c9-d3 da-dc e1 e9-f3 fa-fc e000-e001
//
// That covers á é í ó ú ü ñ ¿ ¡ in both cases, so display copy may carry its
// accents. Anything outside that set still falls through to the next family
// in `--font-display`: redraw from the upstream binary and the accents are gone
// again, which is why this is measured and not remembered.
const kraut = localFont({
  src: './fonts/kraut.woff2',
  variable: '--font-kraut',
  display: 'swap',
});

/**
 * The line under the brand name in a search result, and on a shared link.
 *
 * The drop's name, not a description of the shop: this is what a person sees
 * before deciding to click, and "ya disponible" is the only thing on the page
 * that is time-sensitive. It changes when the drop does.
 */
const TAGLINE = 'VOLUMEN 1: ADRENALINE ya disponible';

export const metadata: Metadata = {
  // The origin every relative canonical and OpenGraph image below resolves
  // against. Without it, a relative URL in a metadata field is a BUILD ERROR,
  // not a silent fallback — see `@/lib/site-url` for why the domain does not
  // have to be decided for this to work.
  metadataBase: siteUrl(),
  title: {
    // `template` applies to CHILD segments only, never to this one, which is
    // why a `default` is required alongside it: the landing renders the
    // default, and the PDP's own title renders through the template.
    default: BRAND,
    template: `✠ %s ✠ ${BRAND}`,
  },
  description: TAGLINE,
  openGraph: {
    title: BRAND,
    description: TAGLINE,
    siteName: BRAND,
    locale: BRAND_LOCALE,
    type: 'website',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='es'
      className={`${specialElite.variable} ${geistMono.variable} ${kraut.variable} h-full max-w-svw antialiased overflow-x-hidden`}
    >
      <body className='min-h-full flex flex-col '>{children}</body>
    </html>
  );
}
