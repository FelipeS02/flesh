/**
 * The share card for one product: the editorial chain plate from `public/`
 * with the garment's own catalogue photograph composited over it.
 *
 * No type on the card, deliberately. The name and the price already travel in
 * `og:title` and `og:description`, and every platform draws its own caption
 * under the image — burning them into the PNG would print them twice.
 *
 * The photograph is the real one rather than something redrawn here, because a
 * card that promises a garment the page does not show is worse than no card.
 *
 * No `runtime` export on purpose: `nodejs` is the default and the Edge runtime
 * is deprecated — see `route-segment-config/runtime.md` in the installed Next.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { getProductByHandle } from "@/modules/catalog";

export const alt = `Prenda de ${BRAND} sobre la placa de cadenas`;
export const contentType = "image/png";

/**
 * The plate, read ONCE per cold start rather than per card. It ships with the
 * deployment and never varies by product, so the only thing a render actually
 * waits on is the garment photograph.
 *
 * Read from disk, never fetched from our own origin: a fetch would depend on
 * `SITE_URL` being set and on the deployment being able to call itself, which
 * is two ways for a share card to break over a file sitting right there.
 */
const plate = await readFile(join(process.cwd(), "public/product-og-image.png"));
const PLATE_SRC = `data:image/png;base64,${plate.toString("base64")}`;

/**
 * The card is the plate, MEASURED rather than declared.
 *
 * The plate is drawn edge to edge, so these two numbers are not a frame around
 * the artwork — they are its aspect ratio. Written by hand they are a second
 * copy of a fact the file already states, and the day the artwork is redrawn
 * in another shape the copy is simply wrong: the card keeps its old
 * proportions and the plate is STRETCHED to fill them. Nothing errors, nothing
 * looks broken in code review, and the distortion only ever shows up in
 * somebody's chat preview.
 *
 * Reading it from the bytes removes that failure entirely. Swapping
 * `public/product-og-image.png` for art of any size is now the whole change.
 */
export const size = plateSize(plate);

/**
 * How much of the card's shorter side the garment is allowed to occupy.
 *
 * The shorter side rather than the width or the height, so the composition
 * survives a plate in either orientation: on a portrait card it is the width
 * that runs out first, on a landscape one the height, and taking the smaller
 * of the two means the garment never reaches an edge it was meant to float
 * inside. THIS is the knob for how big the garment reads on the card.
 */
const GARMENT_SCALE = 0.9;
const GARMENT_BOX = Math.round(Math.min(size.width, size.height) * GARMENT_SCALE);

/**
 * Width and height out of a PNG's IHDR chunk.
 *
 * Both live at fixed offsets — the 8-byte signature, then the chunk's own
 * 4-byte length and 4-byte type put width at 16 and height at 20 — so this
 * needs no decoder for a file we already hold in memory.
 *
 * It THROWS rather than falling back to a default, and at module scope that
 * means the build fails. A share card silently drawn at some guessed size is
 * the exact outcome this function exists to prevent, so it must not be able to
 * produce one.
 */
function plateSize(bytes: Buffer): { width: number; height: number } {
  const isPng =
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ) && bytes.subarray(12, 16).toString("ascii") === "IHDR";

  if (!isPng) {
    throw new Error("public/product-og-image.png is not a PNG with a leading IHDR chunk.");
  }

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** `--background` from `globals.css`, in the only notation satori reads. */
const INK = "#000000";

/**
 * A CDN that hangs is the same outage as a CDN that 404s, and neither should
 * cost more than this. Well under any crawler's own patience.
 */
const PHOTO_TIMEOUT_MS = 4000;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductByHandle(slug);

  // First by position, and taken as-is: `mapToProductView` already sorts the
  // gallery (see `catalog/domain/map.ts`), so this is the same photograph the
  // PDP opens on — re-sorting here would only restate a guarantee the mapper's
  // own tests already hold.
  const cover = product?.images[0]?.src;
  const photo = cover ? await loadPhoto(cover) : null;

  return new ImageResponse(<Card photo={photo} />, { ...size });
}

/**
 * The garment photograph as a data URL, or `null` when the CDN did not hand
 * one over.
 *
 * Fetched HERE instead of being handed to satori as a URL, and that is the
 * whole point of the function. `ImageResponse` renders into a stream that is
 * consumed AFTER this route returns, so an image fetch that fails inside it
 * throws where no `try` of ours can stand — the crawler gets a 500 and the
 * product shares with no card at all. Pulling the bytes first turns every
 * failure into a `null` the composition already knows how to draw around.
 */
async function loadPhoto(src: string): Promise<string | null> {
  try {
    const response = await fetch(src, {
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    // The CDN's own answer, not a guess from the extension: Tiendanube serves
    // the same image as png, jpeg or webp depending on what it has.
    const type = response.headers.get("content-type") ?? "image/jpeg";

    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * `photo` is `null` for a garment with no gallery, and for a handle no longer
 * in the catalogue — the plate alone still reads as FLESH, which is better
 * than a broken preview in a chat thread where the link was already shared.
 */
function Card({ photo }: { photo: string | null }) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: INK,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
        width: "100%",
      }}
    >
      <img
        alt=""
        height={size.height}
        src={PLATE_SRC}
        style={{ left: 0, position: "absolute", top: 0 }}
        width={size.width}
      />

      {photo && (
        // Contained rather than covered, and inset from the edges: the garment
        // is a cut-out on transparency, so cropping it would sever a sleeve
        // instead of trimming a background that was never there.
        <img
          alt=""
          src={photo}
          style={{
            height: GARMENT_BOX,
            objectFit: "contain",
            width: GARMENT_BOX,
          }}
        />
      )}
    </div>
  );
}
