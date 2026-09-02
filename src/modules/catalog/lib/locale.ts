// Structurally matches the wire's `{en, es, pt}` shape (see
// `../api/schema.ts`'s `LangTextSchema`), but is defined independently
// rather than importing it — this is a generic locale-resolution utility,
// not something that should depend on the wire contract's shape.
export interface LocalizedText {
  en: string;
  es: string;
  pt: string;
}

// UI copy is Spanish (see decision: scope-and-locale) — every caller that
// omits a locale gets the `es` value.
const DEFAULT_LOCALE: keyof LocalizedText = "es";

/**
 * Resolves one locale's value out of a `{en, es, pt}` wire object. Components
 * MUST NOT read these language-keyed objects directly — this accessor is the
 * only place a locale key is picked.
 */
export function pick(
  text: LocalizedText,
  locale: keyof LocalizedText = DEFAULT_LOCALE,
): string {
  return text[locale];
}
