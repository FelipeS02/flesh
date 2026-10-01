import { describe, expect, it } from "vitest";
import { STOCK_GLYPH_FRAMES } from "../stock-glyph-frames";

/**
 * Walks a path made only of M/L/H/V/Z (absolute or relative) to its absolute
 * vertices, honouring SVG's implicit command repetition — the rule that bit
 * this file once: after an `h`, bare numbers are MORE `h`s, so dropping an
 * `l` there silently turns a diagonal into two horizontal runs.
 */
function vertices(d: string): [number, number][] {
  const tokens = d.match(/[MLHVZmlhvz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const out: [number, number][] = [];
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (let i = 0; i < tokens.length; ) {
    if (/[a-z]/i.test(tokens[i]!)) {
      command = tokens[i++]!;
      if (command === "z" || command === "Z") {
        x = startX;
        y = startY;
        continue;
      }
    }
    const next = () => Number(tokens[i++]);
    switch (command) {
      case "M": x = next(); y = next(); startX = x; startY = y; command = "L"; break;
      case "m": x += next(); y += next(); startX = x; startY = y; command = "l"; break;
      case "L": x = next(); y = next(); break;
      case "l": x += next(); y += next(); break;
      case "H": x = next(); break;
      case "h": x += next(); break;
      case "V": y = next(); break;
      case "v": y += next(); break;
      default: throw new Error(`Unexpected path command "${command}"`);
    }
    out.push([x, y]);
  }

  return out;
}

describe("STOCK_GLYPH_FRAMES", () => {
  it.each(STOCK_GLYPH_FRAMES.map((d, index) => [index + 1, d]))(
    "keeps every vertex of frame %i inside the 200×200 viewBox",
    (_, d) => {
      // A mis-encoded command does not throw — it just walks the pen off the
      // grid, and the skull renders as shards. Bounds are the cheap tell.
      const outside = vertices(d).filter(
        ([x, y]) => x < -0.5 || x > 200.5 || y < -0.5 || y > 200.5,
      );

      expect(outside).toEqual([]);
    },
  );
});
