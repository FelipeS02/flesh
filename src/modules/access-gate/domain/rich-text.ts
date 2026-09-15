export type RichTextSegment = { text: string; strong: boolean };

// Only a *paired* `**...**` becomes bold; an unmatched marker, or a run of
// markers with nothing between them, has no match and falls through to the
// trailing plain-text slice below — so malformed input degrades to literal
// text instead of throwing or silently eating the asterisks.
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

/**
 * Parses the `**bold**` subset only. Callers (`RichSubtitle`) must render
 * every segment's `text` back through React as a plain string child, never
 * `dangerouslySetInnerHTML` — this config value is server-only copy, but the
 * same reasoning as `serializeJsonLd` (product-jsonld.ts) applies: nothing
 * that came from outside the source tree should ever be handed to the DOM
 * as markup, because a literal `</script>`-shaped string is reachable input.
 */
export function parseRichText(input: string): RichTextSegment[] {
  if (!input) return [];

  const segments: RichTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(input)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: input.slice(cursor, match.index), strong: false });
    }
    segments.push({ text: match[1], strong: true });
    cursor = BOLD_PATTERN.lastIndex;
  }

  if (cursor < input.length) {
    segments.push({ text: input.slice(cursor), strong: false });
  }

  return segments;
}
