import { afterEach, describe, expect, it } from "vitest";
import { metaPixelBootstrap, metaPixelSource, readMetaConfig } from "../config";

describe("readMetaConfig", () => {
  it("disables the pixel when the public id is absent or not a bare number", () => {
    expect(readMetaConfig({})).toBeNull();
    expect(readMetaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "" })).toBeNull();
    expect(readMetaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "pixel-1" })).toBeNull();
    expect(
      readMetaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "1234567890123456x" }),
    ).toBeNull();
  });

  it("accepts the build-time pixel selected for this environment", () => {
    expect(
      readMetaConfig({ NEXT_PUBLIC_META_PIXEL_ID: " 1234567890123456 " }),
    ).toEqual({ pixelId: "1234567890123456" });
  });
});

// Mirrors the GA4 regression in ../config.test.ts: every other case injects an
// environment, so nothing would exercise the default argument, and the bug it
// guards against is invisible — the server-rendered tag keeps loading while the
// browser reads undefined and drops every event.
describe("readMetaConfig with no injected environment", () => {
  const original = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = original;
  });

  it("reads the ambient public pixel id", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "9876543210987654";

    expect(readMetaConfig()).toEqual({ pixelId: "9876543210987654" });
  });

  it("disables the pixel when the ambient id is absent", () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;

    expect(readMetaConfig()).toBeNull();
  });
});

describe("meta pixel bootstrap", () => {
  it("loads the pixel from Meta's own origin", () => {
    expect(metaPixelSource()).toBe(
      "https://connect.facebook.net/en_US/fbevents.js",
    );
  });

  it("initialises the configured pixel", () => {
    expect(metaPixelBootstrap("1234567890123456")).toContain(
      "fbq('init','1234567890123456')",
    );
  });

  // PageView is emitted by the tracker on every pathname change, exactly as the
  // GA4 tag boots with send_page_view:false. Letting the snippet fire its own
  // would double-count the first page of every visit.
  it("leaves the initial pageview to the tracker", () => {
    expect(metaPixelBootstrap("1234567890123456")).not.toContain("PageView");
  });

  it("never interpolates an invalid identifier into executable script", () => {
    expect(() => metaPixelBootstrap("123');alert(1)//")).toThrow(/pixel id/i);
  });
});
