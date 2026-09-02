import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses SITE_URL when the domain is configured", () => {
    vi.stubEnv("SITE_URL", "https://flesh.com.ar");

    expect(siteUrl().toString()).toBe("https://flesh.com.ar/");
  });

  it("falls back to the Vercel host, which arrives without a scheme", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "flesh.vercel.app");

    expect(siteUrl().toString()).toBe("https://flesh.vercel.app/");
  });

  it("falls back to localhost so a dev build still resolves absolute URLs", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(siteUrl().toString()).toBe("http://localhost:3000/");
  });

  it("ignores a blank SITE_URL rather than crashing on it", () => {
    vi.stubEnv("SITE_URL", "   ");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(siteUrl().toString()).toBe("http://localhost:3000/");
  });
});
