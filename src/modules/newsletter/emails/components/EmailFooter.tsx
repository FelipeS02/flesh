import { Link, Section, Text } from "react-email";
import { emailTheme as t, legacyBackground } from "../theme";

// The storefront nav links this same profile; keep the two in step.
export const INSTAGRAM_URL = "https://www.instagram.com/flesh.ar/";

type EmailFooterProps = {
  baseUrl: string;
  why: string;
  unsubscribeUrl?: string;
};

const linkStyle = {
  fontFamily: t.font.body,
  fontSize: t.size.small,
  letterSpacing: "0.2em",
  color: t.color.foreground,
  textDecoration: "underline",
} as const;

export function EmailFooter({ baseUrl, why, unsubscribeUrl }: EmailFooterProps) {
  return (
    <Section
      {...legacyBackground(t.color.footer)}
      style={{
        marginTop: t.space.section,
        padding: `${t.space.section}px ${t.space.side}px`,
        backgroundColor: t.color.footer,
      }}
    >
      <Text
        style={{
          margin: `0 0 ${t.space.gap}px`,
          fontFamily: t.font.body,
          fontSize: t.size.eyebrow,
          lineHeight: 1.6,
          color: t.color.mutedForeground,
        }}
      >
        {why}
      </Text>
      <Text style={{ margin: `0 0 ${t.space.gap}px` }}>
        {unsubscribeUrl ? (
          <>
            <Link href={unsubscribeUrl} style={linkStyle}>
              DARME DE BAJA
            </Link>
            {"  "}
          </>
        ) : null}
        <Link href={INSTAGRAM_URL} style={linkStyle}>
          INSTAGRAM
        </Link>
        {"  "}
        <Link href={baseUrl} style={linkStyle}>
          FLESH.AR
        </Link>
      </Text>
      <Text
        style={{
          margin: 0,
          fontFamily: t.font.body,
          fontSize: t.size.small,
          letterSpacing: "0.2em",
          color: t.color.mutedForeground,
        }}
      >
        FLESH · BUENOS AIRES, ARGENTINA
      </Text>
    </Section>
  );
}
