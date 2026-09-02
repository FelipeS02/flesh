/**
 * Markup → the sentence a search result actually prints.
 *
 * `descriptionHtml` is sanitised, not plain: it still carries `<p>`, `<strong>`
 * and the entities the sanitiser escaped. A `<meta name="description">` and a
 * JSON-LD `description` both want text, so this is the one place that unwraps
 * it — for both, identically.
 */

/** Tags that end a line of reading. Everything else is inline. */
const BLOCK_BOUNDARY = /<\/(?:p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi;

/**
 * Only the five entities the sanitiser can emit. A general decoder would mean
 * shipping a table for glyphs no merchant has ever typed here.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Block boundaries become a space, inline tags become nothing.
 *
 * The distinction is the whole point: dropping `</p>` outright would weld
 * "negra" to the next paragraph's "arte", while turning `<strong>` into a
 * space would leave "negra , arte" with a gap before the comma.
 */
export function plainText(html: string): string {
  return html
    .replace(BLOCK_BOUNDARY, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (entity) => ENTITIES[entity]!)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trims to `limit` characters INCLUDING the ellipsis, cutting on a word
 * boundary — a description sliced mid-word reads as broken data rather than as
 * a summary. Text already inside the limit is returned untouched, with no
 * ellipsis: it was not shortened.
 */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const head = text.slice(0, limit - 1);
  const lastSpace = head.lastIndexOf(" ");

  // A single word longer than the limit has no boundary to cut on, so it is
  // cut where it is rather than returned over budget.
  return `${lastSpace > 0 ? head.slice(0, lastSpace) : head}…`;
}
