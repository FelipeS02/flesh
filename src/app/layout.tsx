import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { BRAND, BRAND_LOCALE } from "@/lib/brand";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Copperplate Gothic Std 30 AB (Adobe), the body voice: the all-caps glyphic
// face the product descriptions, spec lists and size labels are set in.
//
// No unicode-range is declared here, and that is a measurement, not an
// oversight:
//
//   fc-query --format='%{charset}\n' src/app/fonts/copperplate-gothic-30ab.ttf
//   -> 20-7e a0-ff 131 141-142 152-153 ... (Latin-1 Supplement and beyond)
//
// `a0-ff` covers á é í ó ú ñ ¿ ¡, so unlike Kraut this face renders the whole
// Spanish copy on its own and needs no fallback family to patch accents.
const copperplate = localFont({
  src: "./fonts/copperplate-gothic-30ab.ttf",
  variable: "--font-copperplate",
  display: "swap",
});

// Kraut-type-a-fuck (Mr.Fisk, 2003), the display face.
//
// The unicode-range below is MEASURED from the binary, never guessed:
//
//   fc-query --format='%{charset}\n' src/app/fonts/kraut.ttf
//   -> 20-7e e000-e001
//
// That is printable ASCII plus two private-use glyphs, and NOTHING else. The
// font has no accented Latin coverage at all: no á é í ó ú ñ, no ¿ ¡. Since
// the UI copy is Spanish, declaring the range is what makes the browser fall
// through to the next family in `--font-display` for those characters instead
// of stretching Kraut over glyphs it does not have.
const kraut = localFont({
  src: "./fonts/kraut.ttf",
  variable: "--font-kraut",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0020-007E, U+E000-E001" }],
});

/**
 * The line under the brand name in a search result, and on a shared link.
 *
 * The drop's name, not a description of the shop: this is what a person sees
 * before deciding to click, and "ya disponible" is the only thing on the page
 * that is time-sensitive. It changes when the drop does.
 */
const TAGLINE = "VOLUMEN 1: ADRENALINE ya disponible";

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
    template: `%s — ${BRAND}`,
  },
  description: TAGLINE,
  openGraph: {
    title: BRAND,
    description: TAGLINE,
    siteName: BRAND,
    locale: BRAND_LOCALE,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${copperplate.variable} ${geistMono.variable} ${kraut.variable} h-full antialiased`}
    >
      {/* `useQueryState` throws without an adapter mounted above it, and the
          PDP's variant selection is the first consumer. The adapter puts its
          own `useSearchParams` reader behind an internal `<Suspense>`, so
          mounting it at the root does NOT opt every page into dynamic
          rendering. */}
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
