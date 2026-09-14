import { describe, expect, it } from "vitest";
import { MEDIA_WIDTHS, mediaOriginal, mediaSource, mediaVariant } from "./media";

// The exact shape the Tiendanube API returns, kept verbatim: the whole module
// is a string rewrite, so a paraphrased fixture would prove nothing about the
// URLs it builds.
const SRC =
  "https://dcdn-us.mitiendanube.com/stores/008/176/730/products/front-1-9566364c5192ddd31117892767576355-1024-1024.png";
const BASE =
  "https://dcdn-us.mitiendanube.com/stores/008/176/730/products/front-1-9566364c5192ddd31117892767576355";

describe("mediaVariant", () => {
  it("builds the -<width>-0.webp form the CDN actually serves", () => {
    expect(mediaVariant(SRC, 240)).toBe(`${BASE}-240-0.webp`);
  });

  it("snaps UP to the next generated width, never down", () => {
    // 128 is what a 64px thumbnail needs at 2x. Snapping down to 100 would
    // upscale in the browser, which is the blur this module exists to avoid.
    expect(mediaVariant(SRC, 128)).toBe(`${BASE}-240-0.webp`);
  });

  it("returns an exact match without rounding it away", () => {
    expect(mediaVariant(SRC, 480)).toBe(`${BASE}-480-0.webp`);
  });

  it("refuses a width past the widest derivative instead of inventing a 403", () => {
    expect(mediaVariant(SRC, 641)).toBeNull();
  });

  it("leaves a URL it cannot parse alone rather than guessing a suffix", () => {
    expect(mediaVariant("https://example.com/seeded.png", 240)).toBeNull();
  });

  it("only ever emits widths the CDN has generated", () => {
    const emitted = [1, 49, 50, 51, 99, 240, 481, 640].map((width) =>
      mediaVariant(SRC, width),
    );

    for (const url of emitted) {
      const width = Number(/-(\d+)-0\.webp$/.exec(url ?? "")?.[1]);
      expect(MEDIA_WIDTHS).toContain(width);
    }
  });
});

describe("mediaOriginal", () => {
  it("strips the size suffix to reach the untouched upload", () => {
    expect(mediaOriginal(SRC)).toBe(`${BASE}.png`);
  });

  it("keeps the original extension, because .webp 403s on the original", () => {
    expect(mediaOriginal(SRC)).not.toContain(".webp");
  });

  it("passes through a URL carrying no size suffix", () => {
    expect(mediaOriginal("https://example.com/seeded.png")).toBe(
      "https://example.com/seeded.png",
    );
  });

  it("does not mistake digits inside the product handle for the suffix", () => {
    const handle = `${BASE}-2024-drop-1024-1024.png`;

    expect(mediaOriginal(handle)).toBe(`${BASE}-2024-drop.png`);
  });
});

describe("mediaSource", () => {
  it("hands a thumbnail to the CDN and tells Next to stay out of it", () => {
    expect(mediaSource(SRC, { width: 64 })).toEqual({
      src: `${BASE}-240-0.webp`,
      unoptimized: true,
    });
  });

  it("accounts for device pixel ratio when picking the derivative", () => {
    // Same slot, different assumption: 320 at 1x fits the 320 derivative,
    // while at 2x it needs 640.
    expect(mediaSource(SRC, { width: 320, dpr: 1 }).src).toBe(`${BASE}-320-0.webp`);
    expect(mediaSource(SRC, { width: 320, dpr: 2 }).src).toBe(`${BASE}-640-0.webp`);
  });

  it("falls back to the original once no derivative is wide enough", () => {
    // 560 CSS px is the PDP gallery stage; at 2x it needs 1120, and the
    // widest derivative is 640.
    expect(mediaSource(SRC, { width: 560 })).toEqual({
      src: `${BASE}.png`,
      unoptimized: false,
    });
  });

  it("optimizes the fallback, because the original is an unconverted PNG", () => {
    expect(mediaSource(SRC, { width: 560 }).unoptimized).toBe(false);
  });

  it("leaves an unrecognised URL to Next rather than breaking the image", () => {
    const seeded = "https://example.com/seeded.png";

    expect(mediaSource(seeded, { width: 64 })).toEqual({
      src: seeded,
      unoptimized: false,
    });
  });
});
