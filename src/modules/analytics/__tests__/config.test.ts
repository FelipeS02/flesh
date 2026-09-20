import { afterEach, describe, expect, it } from "vitest";
import {
  googleTagBootstrap,
  googleTagSource,
  readAnalyticsConfig,
} from "../config";

describe("readAnalyticsConfig", () => {
  it("disables analytics when the public measurement id is absent or invalid", () => {
    expect(readAnalyticsConfig({})).toBeNull();
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "UA-legacy" }),
    ).toBeNull();
  });

  it("accepts the build-time stream selected for this environment", () => {
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123" }),
    ).toEqual({ measurementId: "G-ABC123" });
  });
});

// The bug these cover shipped green: every other case passes an environment in,
// so nothing ever exercised the default argument, and the client read undefined
// while the server-rendered tag kept loading fine.
describe("readAnalyticsConfig with no injected environment", () => {
  const original = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = original;
  });

  it("reads the ambient public measurement id", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-DEFAULT1";

    expect(readAnalyticsConfig()).toEqual({ measurementId: "G-DEFAULT1" });
  });

  it("disables analytics when the ambient id is absent", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    expect(readAnalyticsConfig()).toBeNull();
  });
});

describe("direct Google tag bootstrap", () => {
  it("loads the configured stream and disables the initial automatic pageview", () => {
    expect(googleTagSource("G-ABC123")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(googleTagBootstrap("G-ABC123")).toContain(
      "gtag('config','G-ABC123',{send_page_view:false})",
    );
  });

  it("never interpolates an invalid identifier into executable script", () => {
    expect(() => googleTagBootstrap("G-X';alert(1)//")).toThrow(
      /measurement id/i,
    );
  });
});
