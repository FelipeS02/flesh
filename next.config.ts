import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // AVIF first, and this is about the ARTWORK, not about bytes.
    //
    // Lossy WebP stores colour at half resolution — 4:2:0, with no option to
    // turn it off; sharp's `WebpOptions` does not even expose one. The drop's
    // graphics are saturated red on pure black, which is the worst case that
    // rule has: every letter edge is a hard chroma jump, and half-resolution
    // chroma smears exactly those. AVIF defaults to 4:4:4 and keeps them.
    //
    // Order matters: Next offers these in sequence and the browser takes the
    // first it understands, so WebP stays as the fallback for anything that
    // cannot read AVIF.
    formats: ["image/avif", "image/webp"],
    // Required since Next 16 — an unlisted `quality` is coerced to the
    // nearest allowed entry rather than honoured, so without 90 here the
    // gallery would silently fall back to 75 and the config would read as
    // if it were working.
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dcdn-us.mitiendanube.com",
      },
    ],
  },
};

// Serves the BotID challenge through this origin, so an ad-blocker that drops
// third-party scripts cannot strip the proof a real shopper's checkout needs.
export default withBotId(nextConfig);
