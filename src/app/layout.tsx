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

// Both faces ship as WOFF2, converted from the TTFs they were licensed as.
//
// `next/font/local` PRELOADS what it is given, so the format is not a
// packaging detail: as TTF these two put 172 KB of uncompressed font in the
// head, competing for bandwidth with the image the page is measured on. The
// same glyphs as WOFF2 are 74 KB. Nothing else changed — WOFF2 is a lossless
// container around the same outlines, which is why the charsets measured
// below still hold. The TTFs are not in the repo; re-run those commands
// against the original files if the faces are ever replaced.

// Copperplate Gothic Std 30 AB (Adobe), the body voice: the all-caps glyphic
// face the product descriptions, spec lists and size labels are set in.
//
// No unicode-range is declared here, and that is a measurement, not an
// oversight:
//
//   fc-query --format='%{charset}\n' copperplate-gothic-30ab.ttf   # the upstream binary
//   -> 20-7e a0-ff 131 141-142 152-153 ... (Latin-1 Supplement and beyond)
//
// `a0-ff` covers á é í ó ú ñ ¿ ¡, so unlike Kraut this face renders the whole
// Spanish copy on its own and needs no fallback family to patch accents.
const copperplate = localFont({
  src: './fonts/copperplate-gothic-30ab.woff2',
  variable: '--font-copperplate',
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
    template: `♱ %s ♱ ${BRAND}`,
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
      className={`${copperplate.variable} ${geistMono.variable} ${kraut.variable} h-full max-w-svw antialiased overflow-x-hidden`}
    >
      <body className='min-h-full flex flex-col '>{children}</body>
    </html>
  );
}
