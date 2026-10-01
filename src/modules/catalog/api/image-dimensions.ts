import "server-only";
import { imageSize } from "image-size";
import { unstable_cache } from "next/cache";

export type ImageDimensions = { width: number; height: number };

/** What identifies one image's BYTES: where they are, and when they last changed. */
export type ImageToMeasure = { src: string; updatedAt?: string };

/** Resolves to `null` when the size cannot be known. Never rejects. */
export type ImageMeasurer = (image: ImageToMeasure) => Promise<ImageDimensions | null>;

/**
 * How much of the file the first request asks for. A PNG keeps its size in
 * the first 24 bytes and a typical JPEG within a few KB, so 64 KB covers the
 * header of almost every photo at a tiny fraction of the download.
 */
export const MEASURE_RANGE_BYTES = 65_536;

const DEFAULT_TIMEOUT_MS = 8_000;
const CACHE_KEY = "image-dimensions-v1";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type ReadSize = (bytes: Uint8Array) => { width?: number; height?: number };

type Dependencies = {
  fetchImpl?: FetchLike;
  readSize?: ReadSize;
  timeoutMs?: number;
};

/**
 * Reads an image's intrinsic size from the head of the file. REJECTS on any
 * failure (network, status, not an image, nonsense size): the caller decides
 * what a failure means, and the cache below must never see one as a result.
 *
 * `image-size` rather than `sharp`: sharp decodes, and cannot read a
 * truncated JPEG, which is exactly what a ranged request returns.
 */
export function readImageDimensions(
  dependencies: Dependencies = {},
): (src: string) => Promise<ImageDimensions> {
  const fetchImpl: FetchLike = dependencies.fetchImpl ?? ((input, init) => fetch(input, init));
  const readSize: ReadSize = dependencies.readSize ?? ((bytes) => imageSize(bytes));
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const fetchBytes = async (src: string, limit: number | null): Promise<Uint8Array> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(src, {
        method: "GET",
        // Never the Next fetch cache: the result is cached once, by key,
        // below, and a second copy of the bytes would only waste its storage.
        cache: "no-store",
        headers: limit === null ? {} : { range: `bytes=0-${limit - 1}` },
        signal: controller.signal,
      });
      // 206 is the answer to a range; 200 is a server that ignored it.
      if (response.status !== 206 && response.status !== 200) {
        throw new Error(`Image request failed with status ${response.status}.`);
      }

      return await readUpTo(response, limit);
    } finally {
      clearTimeout(timer);
    }
  };

  const toDimensions = (bytes: Uint8Array): ImageDimensions => {
    const { width, height } = readSize(bytes);
    if (!width || !height || width < 1 || height < 1) throw new Error("Image has no usable size.");

    return { width, height };
  };

  return async (src) => {
    const head = await fetchBytes(src, MEASURE_RANGE_BYTES);

    try {
      return toDimensions(head);
    } catch (error) {
      // A head shorter than the range IS the whole file: nothing more to ask.
      if (head.length < MEASURE_RANGE_BYTES) throw error;
    }

    // Some JPEGs bury the frame header behind a large metadata block, past the
    // range. One full read, and no more.
    return toDimensions(await fetchBytes(src, null));
  };
}

/**
 * Collects the body, but at most `limit` bytes of it: a server that answers
 * 200 to a ranged request would otherwise have us download the whole photo
 * just to read its header.
 */
async function readUpTo(response: Response, limit: number | null): Promise<Uint8Array> {
  if (limit === null || !response.body) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  while (length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  await reader.cancel().catch(() => undefined);

  const bytes = new Uint8Array(Math.min(length, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, bytes.length - offset);
    bytes.set(chunk.subarray(0, take), offset);
    offset += take;
  }

  return bytes;
}

/**
 * Persists measurements across deploys and snapshot rebuilds.
 *
 * The key is the image's src AND its `updated_at`, and there is deliberately
 * no time-based revalidation: for a given pair the bytes never change. A
 * replaced image bumps `updated_at` whether or not its URL changes, which is
 * what makes the key correct either way.
 *
 * The read throws inside the cached function so a failure is never stored —
 * swallowing it there would pin "unknown" for that image until the key
 * changed. It becomes `null` only out here, and only for this one call.
 */
export function cachedImageMeasurer(
  read: (src: string) => Promise<ImageDimensions>,
): ImageMeasurer {
  return async ({ src, updatedAt }) => {
    try {
      return await unstable_cache(() => read(src), [CACHE_KEY, src, updatedAt ?? ""])();
    } catch {
      return null;
    }
  };
}
