import { beforeEach, describe, expect, it, vi } from "vitest";

// `unstable_cache` is the persistence layer, not the thing under test. The
// stand-in records the key parts it was given and otherwise just runs the
// function, so the tests can prove the key without a Next runtime.
const cache = vi.hoisted(() => ({
  calls: [] as { keyParts: string[]; options: Record<string, unknown> | undefined }[],
}));

vi.mock("next/cache", () => ({
  unstable_cache: (
    fn: () => Promise<unknown>,
    keyParts: string[],
    options?: Record<string, unknown>,
  ) => {
    cache.calls.push({ keyParts, options });
    return fn;
  },
}));

import {
  cachedImageMeasurer,
  MEASURE_RANGE_BYTES,
  readImageDimensions,
} from "../image-dimensions";

/** A minimal PNG: signature, then an IHDR chunk carrying the size. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);

  return bytes;
}

function body(bytes: Uint8Array, status = 206) {
  return new Response(bytes as BlobPart, { status });
}

beforeEach(() => {
  cache.calls.length = 0;
});

describe("readImageDimensions", () => {
  it("asks for only the head of the file and reads the size from it", async () => {
    const fetchImpl = vi.fn(async () => body(png(1200, 1800)));

    const size = await readImageDimensions({ fetchImpl })("https://cdn.example.com/a.png");

    expect(size).toEqual({ width: 1200, height: 1800 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("range")).toBe(`bytes=0-${MEASURE_RANGE_BYTES - 1}`);
  });

  it("accepts a server that ignores Range and answers 200", async () => {
    const fetchImpl = vi.fn(async () => body(png(800, 600), 200));

    await expect(readImageDimensions({ fetchImpl })("https://cdn.example.com/a.png")).resolves.toEqual({
      width: 800,
      height: 600,
    });
  });

  it("stops reading a 200 body at the range limit instead of downloading the whole file", async () => {
    const huge = new Uint8Array(MEASURE_RANGE_BYTES * 4);
    huge.set(png(640, 480), 0);
    const fetchImpl = vi.fn(async () => body(huge, 200));
    const readSize = vi.fn((bytes: Uint8Array) => {
      expect(bytes.length).toBe(MEASURE_RANGE_BYTES);
      return { width: 640, height: 480 };
    });

    await readImageDimensions({ fetchImpl, readSize })("https://cdn.example.com/a.jpg");

    expect(readSize).toHaveBeenCalledTimes(1);
  });

  // Some JPEGs bury the frame header behind a large EXIF/ICC block, past the
  // range. The head alone cannot be parsed, so exactly one full fetch follows.
  it("retries once with the full body when the head is not enough", async () => {
    const full = new Uint8Array(MEASURE_RANGE_BYTES + 10);
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) =>
      body(new Uint8Array(new Headers(init?.headers).has("range") ? MEASURE_RANGE_BYTES : full.length), 200),
    );
    const readSize = vi
      .fn<(bytes: Uint8Array) => { width: number; height: number }>()
      .mockImplementationOnce(() => {
        throw new TypeError("Corrupt JPG, exceeded buffer limits");
      })
      .mockImplementationOnce(() => ({ width: 3000, height: 2000 }));

    const size = await readImageDimensions({ fetchImpl, readSize })("https://cdn.example.com/a.jpg");

    expect(size).toEqual({ width: 3000, height: 2000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect(new Headers(second.headers).has("range")).toBe(false);
  });

  it("does not refetch a file that was already read whole", async () => {
    const fetchImpl = vi.fn(async () => body(new Uint8Array(40), 200));

    await expect(readImageDimensions({ fetchImpl })("https://cdn.example.com/a.txt")).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-image, a failed request and a degenerate size", async () => {
    await expect(
      readImageDimensions({ fetchImpl: async () => body(new TextEncoder().encode("<html>"), 200) })("u"),
    ).rejects.toThrow();
    await expect(
      readImageDimensions({ fetchImpl: async () => new Response(null, { status: 404 }) })("u"),
    ).rejects.toThrow();
    await expect(
      readImageDimensions({
        fetchImpl: async () => body(png(1, 1)),
        readSize: () => ({ width: 0, height: 10 }),
      })("u"),
    ).rejects.toThrow();
    await expect(
      readImageDimensions({
        fetchImpl: async () => {
          throw new Error("network");
        },
      })("u"),
    ).rejects.toThrow();
  });
});

describe("cachedImageMeasurer", () => {
  const measure = async () => ({ width: 10, height: 20 });

  // The bytes behind a src never change for a given updated_at, so the key
  // carries both and there is no time-based revalidation to expire it.
  it("keys the cache by src and updated_at, with no time revalidation", async () => {
    const measureImage = cachedImageMeasurer(measure);

    await expect(
      measureImage({ src: "https://cdn.example.com/a.png", updatedAt: "2026-01-01T00:00:00Z" }),
    ).resolves.toEqual({ width: 10, height: 20 });

    expect(cache.calls[0]!.keyParts).toEqual([
      "image-dimensions-v1",
      "https://cdn.example.com/a.png",
      "2026-01-01T00:00:00Z",
    ]);
    expect(cache.calls[0]!.options ?? {}).not.toHaveProperty("revalidate");
  });

  it("falls back to an empty updated_at in the key when the wire sends none", async () => {
    await cachedImageMeasurer(measure)({ src: "https://cdn.example.com/a.png" });

    expect(cache.calls[0]!.keyParts.at(-1)).toBe("");
  });

  // A failure is thrown INSIDE the cached function so the cache never stores
  // it; swallowing it there would pin "unknown" for that image forever.
  it("reports a failed measurement as null without letting the cache keep it", async () => {
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(cachedImageMeasurer(failing)({ src: "u" })).resolves.toBeNull();
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
