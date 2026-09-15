import { parseRichText } from "../domain/rich-text";

type RichSubtitleProps = {
  text: string;
  className?: string;
};

/**
 * Renders `**bold**`-marked config copy as `<strong>` runs. Every segment
 * goes back through React as a plain string child — never
 * `dangerouslySetInnerHTML` — so React escapes it. Same stance as
 * `serializeJsonLd` (`src/app/producto/[slug]/page.tsx`): this string comes
 * from `ACCESS_GATE_MESSAGE`, an operator-set env var, but the codebase does
 * not special-case "trusted" copy sources for this — a literal
 * `</script>`-shaped value is still reachable input.
 */
export function RichSubtitle({ text, className }: RichSubtitleProps) {
  const segments = parseRichText(text);

  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.strong ? (
          <strong key={index}>{segment.text}</strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
