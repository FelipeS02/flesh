import sanitizeHtmlLib from "sanitize-html";

/**
 * Markup that has passed through `toSafeHtml`. Hand-rolled nominal brand, not
 * a Zod `.brand()`: this is not wire-boundary data being validated, it is the
 * OUTPUT of the sanitiser, already guaranteed by that library. Minting it
 * through a Zod schema would import Zod here for zero functional gain over a
 * zero-runtime-cost intersection type (see tasks 4c.0).
 *
 * The brand is what makes the guarantee structural: the single call site of
 * `dangerouslySetInnerHTML` accepts only `SafeHtml`, and only this module can
 * produce one, so unsanitised HTML reaching the DOM is a TYPE ERROR rather
 * than a code-review question.
 */
declare const safeHtmlBrand: unique symbol;
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

// Merchant formatting only. No media, no tables, no forms, no ids or classes
// — a description field has no legitimate need for them, and every tag left
// out is one less thing to reason about at the live-API swap.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "span",
  "a",
];

/**
 * The ONLY way to produce `SafeHtml`. Strips anything outside the allowlist,
 * restricts links to http(s) — which is what kills `javascript:` and `data:`
 * hrefs — and forces `rel="noopener noreferrer"` rather than trusting a rel
 * that arrived with the markup.
 */
export function toSafeHtml(dirty: string): SafeHtml {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    // `rel` is allowlisted so the value `transformTags` writes below survives
    // attribute filtering, which runs after the transform.
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        // Spread first, override second: an attacker-supplied `rel` is
        // replaced, never merged with.
        attribs: { ...attribs, rel: "noopener noreferrer" },
      }),
    },
  }) as SafeHtml;
}
